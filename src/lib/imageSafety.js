/**
 * First-stage local image-safety pre-screen, before upload.
 * Fail closed: upload is blocked if the model cannot run.
 * Human approval remains mandatory; this is not a server-side security boundary.
 */
let modelPromise
export async function screenImageBeforeUpload(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
    return { allowed: false, reason: 'استعمل صورة JPG أو PNG أو WebP.' }
  }
  if (file.size > 3 * 1024 * 1024) {
    return { allowed: false, reason: 'التصويرة أكبر من 3MB.' }
  }
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs')
      const nsfwjs = await import('nsfwjs')
      await tf.ready()
      return nsfwjs.load('MobileNetV2')
    })().catch(error => {
      modelPromise = null
      throw error
    })
  }

  const localUrl = URL.createObjectURL(file)
  let img
  try {
    img = new Image()
    img.decoding = 'async'
    img.src = localUrl
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('التصويرة غير صالحة أو ما تنجمش تتحلّ.'))
    })
    if (img.naturalWidth < 80 || img.naturalHeight < 80) {
      return { allowed:false,reason:'التصويرة صغيرة برشة، اختار تصويرة أوضح (على الأقل 80px).' }
    }
    const model = await modelPromise
    const predictions = await model.classify(img)
    const scores = Object.fromEntries(predictions.map(p=>[p.className.toLowerCase(),p.probability]))
    const porn = scores.porn || 0
    const hentai = scores.hentai || 0
    const sexy = scores.sexy || 0
    // Conservative automatic filter. False positives are possible.
    if (porn >= .16 || hentai >= .16 || porn + hentai >= .20 || sexy >= .72) {
      return { allowed:false, reason:'التصويرة ترفضت آليًا لأنّها ممكن تحتوي محتوى غير مسموح.' }
    }
    return { allowed:true, reason:'الفحص الأوّلي نجح. الصورة تستنّى مراجعة الإدارة قبل النشر.' }
  } catch (error) {
    return { allowed:false,reason:'تعذّر الفحص الآلي للتصويرة، لذلك الرفع توقف لحماية التطبيق. عاود جرّب.' }
  } finally {
    if (img) img.src = ''
    URL.revokeObjectURL(localUrl)
  }
}
