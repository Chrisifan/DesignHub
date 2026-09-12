# Image fixtures

Task 4 intentionally keeps binary image fixtures out of source control. Host-specific PNG, JPEG, WebP, HEIC, SVG, GIF, PDF, and PSD samples may be supplied by platform integration tests at runtime. Tests should exercise the importer through its byte and decoder boundaries and must not claim codec support when no decoder is supplied.
