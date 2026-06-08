# OpenFace

OpenFace is not bundled in this portfolio demo because the Windows binary and model files are large.

For the secondary facial-feature analysis, download OpenFace separately and place the extracted Windows build here:

```text
tools/openface/OpenFace_2.2.0_win_x64/OpenFace_2.2.0_win_x64/FaceLandmarkImg.exe
```

The analysis script also supports a manual executable path:

```r
Sys.setenv(OPENFACE_FACE_LANDMARK_IMG = "C:/full/path/to/FaceLandmarkImg.exe")
source("intrinsic_image_identification_secondary_openface_analysis.R")
```
