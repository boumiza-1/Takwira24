#!/usr/bin/env python3
"""Set the generated Capacitor Android version safely from GitHub workflow inputs."""
import os
import pathlib
import re
import sys

gradle = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/build.gradle")
code_text = os.environ.get("VERSION_CODE", "")
name = os.environ.get("VERSION_NAME", "")
if not re.fullmatch(r"[1-9][0-9]{0,9}", code_text):
    raise SystemExit("VERSION_CODE must be a positive integer")
code = int(code_text)
if code > 2100000000:
    raise SystemExit("VERSION_CODE exceeds allowed Play Console range")
if not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,3}(?:-[A-Za-z0-9.]+)?", name):
    raise SystemExit("VERSION_NAME must look like 1.0.0")
source = gradle.read_text(encoding="utf-8")
source, code_count = re.subn(r"(?m)^([ \t]*)versionCode[ \t]+[0-9]+[ \t]*$", lambda m: m.group(1) + "versionCode " + str(code), source, count=1)
source, name_count = re.subn(r'(?m)^([ \t]*)versionName[ \t]+"[^"]+"[ \t]*$', lambda m: m.group(1) + 'versionName "' + name + '"', source, count=1)
if code_count != 1 or name_count != 1:
    raise SystemExit("Could not find Android versionCode/versionName in generated build.gradle")
gradle.write_text(source, encoding="utf-8")
print("Android build configured for versionCode " + str(code) + " and versionName " + name)
