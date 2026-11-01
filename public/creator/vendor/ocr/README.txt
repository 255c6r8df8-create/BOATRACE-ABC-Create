Local OCR assets only; no image upload or CDN dependency.
Tesseract.js 6.0.1; tesseract.js-core 6.1.2 (Apache-2.0).
@tesseract.js-data/jpn and eng 1.0.0, local traineddata (Tesseract tessdata, Apache-2.0).
License texts: LICENSE, LICENSE-tesseract-js.md and bundled *.LICENSE.txt.
cacheMethod=none avoids the OCR engine's persistent IndexedDB cache.
Browser Worker/WASM and iPhone Safari still require native acceptance.
