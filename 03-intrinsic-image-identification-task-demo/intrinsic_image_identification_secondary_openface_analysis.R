## Packages
pkgs <- c("tidyverse", "png", "rcicr", "conflicted")
need <- pkgs[!pkgs %in% rownames(installed.packages())]
if (length(need) > 0) install.packages(need, repos = "https://cloud.r-project.org")
ok <- sapply(pkgs, require, character.only = TRUE)
if (!all(ok)) stop("Missing packages even after install(): ", paste(pkgs[!ok], collapse = ", "))

conflicted::conflict_prefer("select", "dplyr")
conflicted::conflict_prefer("filter", "dplyr")

## Settings
baseDir <- getwd()
outputBaseDir <- file.path(baseDir, "outputs_intrinsic_image_identification")
tableDir <- file.path(outputBaseDir, "outputs_tables")
participantCiDir <- file.path(outputBaseDir, "participant_classification_images")
stimulusDir <- file.path(baseDir, "images", "rc_stimuli")
finalDir <- file.path(outputBaseDir, "secondary_openface_analysis")
scatterDir <- file.path(finalDir, "scatter_graphs")
minMaxDir <- file.path(finalDir, "min_max_images")
exampleDir <- file.path(finalDir, "classification_image_examples")

baseImageLabel <- "neutral"
ciScaling <- "independent"
ciScalingConstant <- 0.1

findOpenFace <- function() {
  envPath <- Sys.getenv("OPENFACE_FACE_LANDMARK_IMG", unset = "")
  if (nzchar(envPath) && file.exists(envPath)) {
    return(list(root = dirname(envPath), exe = envPath))
  }

  root <- file.path(
    baseDir,
    "tools", "openface", "OpenFace_2.2.0_win_x64", "OpenFace_2.2.0_win_x64"
  )
  exe <- file.path(root, "FaceLandmarkImg.exe")

  list(root = root, exe = exe)
}

openFacePaths <- findOpenFace()
openFaceRoot <- openFacePaths$root
openFaceExe <- openFacePaths$exe

featureSpecs <- tibble::tribble(
  ~feature, ~label, ~unit_label, ~file_label,
  "gaze_deviation", "Gazing Direction", "Deviation (radians)", "gaze_direction",
  "pupil_area", "Pupil Dilation", "Area (pixels)", "pupil_dilation",
  "mouth_commissure_percent", "Mouth Commissure", "Height (% mouth)", "mouth_commissure",
  "nostril_luminance", "Nostril Luminance", "Luminance (%)", "nostril_luminance",
  "brow_raiser_score", "Eyebrow Raisers", "A.U.", "eyebrow_raisers"
)

## Output Folders
if (dir.exists(finalDir)) unlink(finalDir, recursive = TRUE)
dir.create(scatterDir, recursive = TRUE, showWarnings = FALSE)
dir.create(minMaxDir, recursive = TRUE, showWarnings = FALSE)
dir.create(exampleDir, recursive = TRUE, showWarnings = FALSE)

## Helpers
asNum <- function(x) {
  suppressWarnings(as.numeric(as.character(x)))
}

safeMean <- function(x) {
  if (all(is.na(x))) return(NA_real_)
  mean(x, na.rm = TRUE)
}

safeCol <- function(dat, nm) {
  if (!(nm %in% names(dat))) return(NA_real_)
  asNum(dat[[nm]][1])
}

safeDistance <- function(dat, xPrefix, yPrefix, a, b) {
  xa <- safeCol(dat, paste0(xPrefix, a))
  ya <- safeCol(dat, paste0(yPrefix, a))
  xb <- safeCol(dat, paste0(xPrefix, b))
  yb <- safeCol(dat, paste0(yPrefix, b))
  sqrt((xa - xb)^2 + (ya - yb)^2)
}

readGrayImage <- function(fp) {
  if (!file.exists(fp)) return(NULL)
  img <- png::readPNG(fp)
  if (length(dim(img)) == 3) {
    img <- apply(img[, , seq_len(min(3, dim(img)[3]))], c(1, 2), mean)
  }
  img
}

safeRegionMean <- function(img, xVals, yVals) {
  if (is.null(img)) return(NA_real_)
  if (any(is.na(xVals)) || any(is.na(yVals))) return(NA_real_)
  xs <- seq(max(1, round(min(xVals))), min(ncol(img), round(max(xVals))))
  ys <- seq(max(1, round(min(yVals))), min(nrow(img), round(max(yVals))))
  if (length(xs) == 0 || length(ys) == 0) return(NA_real_)
  mean(img[ys, xs], na.rm = TRUE)
}

parseOpenFaceName <- function(fileName) {
  stem <- sub("\\.csv$", "", basename(fileName))
  m <- stringr::str_match(stem, "^(.*)_(lonely|sad)_(anti_CI|CI)$")
  if (any(is.na(m))) {
    return(tibble::tibble(
      subj_id_clean = NA_character_,
      trait_condition = NA_character_,
      image_type = NA_character_
    ))
  }
  tibble::tibble(
    subj_id_clean = m[2],
    trait_condition = m[3],
    image_type = m[4]
  )
}

runOpenFaceFeatures <- function(imageDir, outputDir) {
  if (!file.exists(openFaceExe)) {
    stop(
      "OpenFace executable not found: ", openFaceExe, "\n",
      "This demo expects the Windows OpenFace build inside tools/openface.\n",
      "If FaceLandmarkImg exists somewhere else, set it manually before sourcing this script:\n",
      "Sys.setenv(OPENFACE_FACE_LANDMARK_IMG = 'C:/full/path/to/FaceLandmarkImg.exe')"
    )
  }
  if (!dir.exists(imageDir)) stop("Image folder not found: ", imageDir)
  dir.create(outputDir, recursive = TRUE, showWarnings = FALSE)

  oldWd <- getwd()
  setwd(openFaceRoot)
  on.exit(setwd(oldWd), add = TRUE)

  args <- c(
    "-fdir", imageDir,
    "-out_dir", outputDir,
    "-2Dfp", "-3Dfp", "-pdmparams", "-pose", "-aus", "-gaze", "-q"
  )
  status <- system2(openFaceExe, args = args)
  if (!is.null(status) && status != 0) stop("OpenFace feature extraction failed with status: ", status)
}

runOpenFaceVisual <- function(imageFile, outputDir) {
  if (!file.exists(openFaceExe)) {
    stop(
      "OpenFace executable not found: ", openFaceExe, "\n",
      "This demo expects the Windows OpenFace build inside tools/openface."
    )
  }
  dir.create(outputDir, recursive = TRUE, showWarnings = FALSE)

  oldWd <- getwd()
  setwd(openFaceRoot)
  on.exit(setwd(oldWd), add = TRUE)

  args <- c("-f", imageFile, "-out_dir", outputDir, "-vis-track", "-format_vis_image", "png")
  status <- system2(openFaceExe, args = args)
  if (!is.null(status) && status != 0) stop("OpenFace visualization failed with status: ", status)
}

readOpenFaceCsv <- function(fp) {
  dat <- read.csv(fp, check.names = TRUE)
  meta <- parseOpenFaceName(fp)
  imgPath <- file.path(
    participantCiDir,
    paste0(meta$subj_id_clean, "_", meta$trait_condition, "_", meta$image_type, ".png")
  )
  img <- readGrayImage(imgPath)

  leftPupilArea <- pi *
    safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 21, 25) / 2 *
    safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 23, 27) / 2

  rightPupilArea <- pi *
    safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 49, 53) / 2 *
    safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 51, 55) / 2

  leftPupilDimension <- pi * (
    safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 21, 25) / 2 +
      safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 23, 27) / 2
  )

  rightPupilDimension <- pi * (
    safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 49, 53) / 2 +
      safeDistance(dat, "eye_lmk_x_", "eye_lmk_y_", 51, 55) / 2
  )

  mouthTop <- safeMean(c(safeCol(dat, "y_50"), safeCol(dat, "y_52")))
  mouthBottom <- safeCol(dat, "y_57")
  mouthHeight <- mouthBottom - mouthTop
  commissureY <- safeMean(c(safeCol(dat, "y_48"), safeCol(dat, "y_54")))
  mouthCommissurePercent <- (commissureY - mouthTop) / mouthHeight * 100

  nostrilLuminance <- safeRegionMean(
    img,
    c(safeCol(dat, "x_31"), safeCol(dat, "x_35")),
    c(safeCol(dat, "y_30"), safeCol(dat, "y_33"))
  )

  auCols <- names(dat)[grepl("^AU[0-9]+_r$", names(dat))]
  auVals <- purrr::map_dfc(auCols, function(nm) {
    tibble::tibble(!!nm := safeCol(dat, nm))
  })

  dplyr::bind_cols(
    meta,
    tibble::tibble(
      file_name = basename(fp),
      confidence = safeCol(dat, "confidence"),
      gaze_angle_x = safeCol(dat, "gaze_angle_x"),
      gaze_angle_y = safeCol(dat, "gaze_angle_y"),
      gaze_deviation = safeMean(abs(c(safeCol(dat, "gaze_angle_x"), safeCol(dat, "gaze_angle_y")))),
      left_pupil_area = leftPupilArea,
      right_pupil_area = rightPupilArea,
      pupil_area = safeMean(c(leftPupilArea, rightPupilArea)),
      left_pupil_dimension = leftPupilDimension,
      right_pupil_dimension = rightPupilDimension,
      pupil_dimension = safeMean(c(leftPupilDimension, rightPupilDimension)),
      mouth_height = mouthHeight,
      mouth_commissure_y = commissureY,
      mouth_commissure_percent = mouthCommissurePercent,
      nostril_luminance = nostrilLuminance,
      pose_Rx = safeCol(dat, "pose_Rx"),
      pose_Ry = safeCol(dat, "pose_Ry"),
      head_pose_deviation = safeMean(abs(c(safeCol(dat, "pose_Rx"), safeCol(dat, "pose_Ry")))),
      brow_raiser_score = safeCol(dat, "AU01_r") + safeCol(dat, "AU02_r") - safeCol(dat, "AU04_r")
    ),
    auVals
  )
}

makePlotData <- function(features, featureName, traitName) {
  targetLabel <- ifelse(traitName == "lonely", "Lonely", "Sad")
  nonTargetLabel <- ifelse(traitName == "lonely", "Non Lonely", "Non Sad")

  features %>%
    dplyr::filter(trait_condition == traitName, image_type %in% c("CI", "anti_CI")) %>%
    dplyr::mutate(
      plot_label = dplyr::case_when(
        image_type == "CI" ~ targetLabel,
        image_type == "anti_CI" ~ nonTargetLabel,
        TRUE ~ NA_character_
      ),
      x = dplyr::case_when(
        image_type == "CI" ~ 1,
        image_type == "anti_CI" ~ 2,
        TRUE ~ NA_real_
      ),
      value = .data[[featureName]]
    ) %>%
    dplyr::filter(!is.na(value))
}

drawScatter <- function(features, featureName, traitName, titleLabel, unitLabel, yLim, outFile) {
  d <- makePlotData(features, featureName, traitName)
  targetLabel <- ifelse(traitName == "lonely", "Lonely", "Sad")
  nonTargetLabel <- ifelse(traitName == "lonely", "Non Lonely", "Non Sad")

  grDevices::png(outFile, width = 650, height = 650, res = 150)
  par(mar = c(5.0, 5.2, 4.2, 1.4))
  plot(
    NA,
    xlim = c(0.65, 2.35),
    ylim = yLim,
    xaxt = "n",
    xlab = "",
    ylab = unitLabel,
    main = titleLabel,
    col.main = "#008f3a",
    cex.main = 1.35,
    font.main = 1
  )
  axis(1, at = c(1, 2), labels = c(targetLabel, nonTargetLabel), cex.axis = 0.85)

  ciValues <- d %>% dplyr::filter(image_type == "CI")
  antiCiValues <- d %>% dplyr::filter(image_type == "anti_CI")
  ciOffsets <- seq(-0.08, 0.08, length.out = nrow(ciValues))
  antiCiOffsets <- seq(-0.08, 0.08, length.out = nrow(antiCiValues))

  points(1 + ciOffsets, ciValues$value, pch = 16, col = "#d65f9f", cex = 0.95)
  points(2 + antiCiOffsets, antiCiValues$value, pch = 16, col = "#5ca9dd", cex = 0.95)
  grDevices::dev.off()
}

pairedTest <- function(dat, featureName, traitName) {
  wide <- dat %>%
    dplyr::filter(trait_condition == traitName, image_type %in% c("CI", "anti_CI")) %>%
    dplyr::select(subj_id_clean, image_type, value = dplyr::all_of(featureName)) %>%
    tidyr::pivot_wider(names_from = image_type, values_from = value) %>%
    dplyr::filter(!is.na(CI), !is.na(anti_CI))

  if (nrow(wide) < 2) {
    return(tibble::tibble(
      trait_condition = traitName,
      feature = featureName,
      n = nrow(wide),
      target_mean = safeMean(wide$CI),
      anti_mean = safeMean(wide$anti_CI),
      mean_diff_target_minus_anti = safeMean(wide$CI - wide$anti_CI),
      t = NA_real_,
      df = NA_real_,
      p = NA_real_,
      dz = NA_real_
    ))
  }

  tt <- t.test(wide$CI, wide$anti_CI, paired = TRUE)
  diffVals <- wide$CI - wide$anti_CI

  tibble::tibble(
    trait_condition = traitName,
    feature = featureName,
    n = nrow(wide),
    target_mean = mean(wide$CI),
    anti_mean = mean(wide$anti_CI),
    mean_diff_target_minus_anti = mean(diffVals),
    t = unname(tt$statistic),
    df = unname(tt$parameter),
    p = tt$p.value,
    dz = mean(diffVals) / sd(diffVals)
  )
}

lonelyVsSadTest <- function(dat, featureName) {
  wide <- dat %>%
    dplyr::filter(image_type == "CI", trait_condition %in% c("lonely", "sad")) %>%
    dplyr::select(subj_id_clean, trait_condition, value = dplyr::all_of(featureName)) %>%
    tidyr::pivot_wider(names_from = trait_condition, values_from = value) %>%
    dplyr::filter(!is.na(lonely), !is.na(sad))

  if (nrow(wide) < 2) {
    return(tibble::tibble(
      feature = featureName,
      n = nrow(wide),
      lonely_mean = safeMean(wide$lonely),
      sad_mean = safeMean(wide$sad),
      mean_diff_lonely_minus_sad = safeMean(wide$lonely - wide$sad),
      t = NA_real_,
      df = NA_real_,
      p = NA_real_,
      dz = NA_real_
    ))
  }

  tt <- t.test(wide$lonely, wide$sad, paired = TRUE)
  diffVals <- wide$lonely - wide$sad

  tibble::tibble(
    feature = featureName,
    n = nrow(wide),
    lonely_mean = mean(wide$lonely),
    sad_mean = mean(wide$sad),
    mean_diff_lonely_minus_sad = mean(diffVals),
    t = unname(tt$statistic),
    df = unname(tt$parameter),
    p = tt$p.value,
    dz = mean(diffVals) / sd(diffVals)
  )
}

uclaRegression <- function(dat, featureName, traitName, predictorName) {
  d <- dat %>%
    dplyr::filter(trait_condition == traitName, image_type == "CI") %>%
    dplyr::filter(!is.na(.data[[featureName]]), !is.na(.data[[predictorName]]))

  if (nrow(d) < 3) {
    return(tibble::tibble(
      trait_condition = traitName,
      feature = featureName,
      predictor = predictorName,
      n = nrow(d),
      slope = NA_real_,
      t = NA_real_,
      p = NA_real_,
      r = NA_real_
    ))
  }

  fit <- lm(stats::as.formula(paste(featureName, "~", predictorName)), data = d)
  sm <- summary(fit)

  tibble::tibble(
    trait_condition = traitName,
    feature = featureName,
    predictor = predictorName,
    n = nrow(d),
    slope = unname(coef(fit)[predictorName]),
    t = sm$coefficients[predictorName, "t value"],
    p = sm$coefficients[predictorName, "Pr(>|t|)"],
    r = stats::cor(d[[featureName]], d[[predictorName]], use = "complete.obs")
  )
}

writeGroupCiImages <- function(rcData, traitName, antiCi, rdataFile) {
  label <- ifelse(antiCi, "anti_CI", "CI")
  stem <- paste("pilot", traitName, label, sep = "_")

  ciResult <- rcicr::generateCI(
    stimuli = rcData$noise_id[rcData$trait_condition == traitName],
    responses = rcData$rcicr_response[rcData$trait_condition == traitName],
    baseimage = baseImageLabel,
    rdata = rdataFile,
    save_as_png = FALSE,
    antiCI = antiCi,
    scaling = ciScaling,
    scaling_constant = ciScalingConstant
  )

  isolatedFile <- file.path(exampleDir, paste0(stem, "_isolated_noise.png"))
  overlaidFile <- file.path(exampleDir, paste0(stem, "_overlaid_face.png"))
  landmarkFile <- file.path(exampleDir, paste0(stem, "_openface_landmarks.png"))

  png::writePNG(ciResult$scaled, isolatedFile)
  png::writePNG(ciResult$combined, overlaidFile)

  visualTempDir <- tempfile("openface_visual_")
  dir.create(visualTempDir, recursive = TRUE, showWarnings = FALSE)
  on.exit(unlink(visualTempDir, recursive = TRUE), add = TRUE)

  runOpenFaceVisual(overlaidFile, visualTempDir)
  visualFile <- file.path(visualTempDir, basename(overlaidFile))
  if (!file.exists(visualFile)) stop("OpenFace did not create expected visualization: ", visualFile)
  file.copy(visualFile, landmarkFile, overwrite = TRUE)

  tibble::tibble(
    trait_condition = traitName,
    image_type = label,
    isolated_noise_file = isolatedFile,
    overlaid_face_file = overlaidFile,
    openface_landmarks_file = landmarkFile
  )
}

copyMinMaxImages <- function(features) {
  madeFiles <- c()

  for (i in seq_len(nrow(featureSpecs))) {
    spec <- featureSpecs[i, ]
    d <- features %>%
      dplyr::filter(!is.na(.data[[spec$feature]]), image_type %in% c("CI", "anti_CI")) %>%
      dplyr::mutate(
        image_file = file.path(participantCiDir, paste0(subj_id_clean, "_", trait_condition, "_", image_type, ".png"))
      ) %>%
      dplyr::filter(file.exists(image_file))

    if (nrow(d) == 0) next

    minRow <- d[which.min(d[[spec$feature]]), ]
    maxRow <- d[which.max(d[[spec$feature]]), ]

    minFile <- file.path(minMaxDir, paste0(spec$file_label, "_minimum_", basename(minRow$image_file)))
    maxFile <- file.path(minMaxDir, paste0(spec$file_label, "_maximum_", basename(maxRow$image_file)))

    file.copy(minRow$image_file, minFile, overwrite = TRUE)
    file.copy(maxRow$image_file, maxFile, overwrite = TRUE)
    madeFiles <- c(madeFiles, minFile, maxFile)
  }

  madeFiles
}

joinSubjectInfo <- function(features) {
  subjectFilterFile <- file.path(tableDir, "subject_filters.csv")
  if (!file.exists(subjectFilterFile)) return(features)

  subjectFilters <- read.csv(subjectFilterFile, stringsAsFactors = FALSE)
  factorScoreFile <- file.path(tableDir, "FA06_ucla_factor_scores.csv")
  factorCols <- character(0)

  if (file.exists(factorScoreFile)) {
    factorScores <- read.csv(factorScoreFile, stringsAsFactors = FALSE)
    factorCols <- setdiff(names(factorScores), "subj_id_clean")
  }

  keepCols <- intersect(
    c("subj_id_clean", "ucla_total", "ucla_group", "include_subject", factorCols),
    names(subjectFilters)
  )

  out <- features %>%
    dplyr::left_join(subjectFilters %>% dplyr::select(dplyr::all_of(keepCols)), by = "subj_id_clean")

  missingFactorCols <- setdiff(factorCols, names(out))
  if (file.exists(factorScoreFile) && length(missingFactorCols) > 0) {
    factorJoinCols <- intersect(c("subj_id_clean", missingFactorCols), names(factorScores))
    out <- out %>%
      dplyr::left_join(factorScores %>% dplyr::select(dplyr::all_of(factorJoinCols)), by = "subj_id_clean")
  }

  out
}

## Feature Extraction
if (!dir.exists(participantCiDir)) {
  stop("Run intrinsic_image_identification_data_analysis.R first. Missing: ", participantCiDir)
}

rawOpenFaceDir <- tempfile("openface_raw_")
dir.create(rawOpenFaceDir, recursive = TRUE, showWarnings = FALSE)
on.exit(unlink(rawOpenFaceDir, recursive = TRUE), add = TRUE)

runOpenFaceFeatures(participantCiDir, rawOpenFaceDir)

openFaceFiles <- list.files(rawOpenFaceDir, pattern = "\\.csv$", full.names = TRUE)
features <- purrr::map_dfr(openFaceFiles, readOpenFaceCsv) %>%
  dplyr::filter(!is.na(subj_id_clean), trait_condition %in% c("lonely", "sad")) %>%
  joinSubjectInfo()

write.csv(features, file.path(finalDir, "openface_feature_values.csv"), row.names = FALSE)

targetAntiTests <- purrr::map_dfr(featureSpecs$feature, function(featureName) {
  purrr::map_dfr(c("lonely", "sad"), ~ pairedTest(features, featureName, .x))
})
write.csv(targetAntiTests, file.path(finalDir, "openface_target_vs_anti_tests.csv"), row.names = FALSE)

lonelySadTests <- purrr::map_dfr(featureSpecs$feature, ~ lonelyVsSadTest(features, .x))
write.csv(lonelySadTests, file.path(finalDir, "openface_lonely_vs_sad_tests.csv"), row.names = FALSE)

uclaTests <- purrr::map_dfr(featureSpecs$feature, function(featureName) {
  purrr::map_dfr(c("lonely", "sad"), ~ uclaRegression(features, featureName, .x, "ucla_total"))
})
write.csv(uclaTests, file.path(finalDir, "openface_ucla_total_regressions.csv"), row.names = FALSE)

factorScoreFile <- file.path(tableDir, "FA06_ucla_factor_scores.csv")
uclaFactorPredictors <- character(0)

if (file.exists(factorScoreFile)) {
  factorScoreNames <- names(read.csv(factorScoreFile, stringsAsFactors = FALSE, nrows = 1))
  uclaFactorPredictors <- intersect(setdiff(factorScoreNames, "subj_id_clean"), names(features))
}

uclaFactorTests <- purrr::map_dfr(uclaFactorPredictors, function(predictorName) {
  purrr::map_dfr(featureSpecs$feature, function(featureName) {
    purrr::map_dfr(c("lonely", "sad"), ~ uclaRegression(features, featureName, .x, predictorName))
  })
})
write.csv(uclaFactorTests, file.path(finalDir, "openface_ucla_factor_regressions.csv"), row.names = FALSE)

## Scatter Graphs
for (i in seq_len(nrow(featureSpecs))) {
  spec <- featureSpecs[i, ]
  dLonely <- makePlotData(features, spec$feature, "lonely")
  dSad <- makePlotData(features, spec$feature, "sad")
  yRange <- range(c(dLonely$value, dSad$value), na.rm = TRUE)
  pad <- diff(yRange) * 0.12
  if (!is.finite(pad) || pad == 0) pad <- 0.1
  yLim <- c(yRange[1] - pad, yRange[2] + pad)

  drawScatter(
    features,
    spec$feature,
    "lonely",
    spec$label,
    spec$unit_label,
    yLim,
    file.path(scatterDir, paste0(spec$file_label, "_lonely_vs_non_lonely.png"))
  )

  drawScatter(
    features,
    spec$feature,
    "sad",
    spec$label,
    spec$unit_label,
    yLim,
    file.path(scatterDir, paste0(spec$file_label, "_sad_vs_non_sad.png"))
  )
}

## Min/Max Images
minMaxFiles <- copyMinMaxImages(features)

## Classification Image Examples
rcTrialFile <- file.path(tableDir, "rc_trial_data.csv")
if (!file.exists(rcTrialFile)) stop("Run intrinsic_image_identification_data_analysis.R first. Missing: ", rcTrialFile)

rdataFiles <- list.files(stimulusDir, pattern = "\\.Rdata$", full.names = TRUE)
if (length(rdataFiles) == 0) stop("No rcicr .Rdata file found in: ", stimulusDir)
rdataFile <- rdataFiles[order(file.info(rdataFiles)$mtime, decreasing = TRUE)][1]

rcData <- read.csv(rcTrialFile, stringsAsFactors = FALSE)

exampleInfo <- purrr::map_dfr(c("lonely", "sad"), function(traitName) {
  purrr::map_dfr(c(FALSE, TRUE), function(antiCi) {
    writeGroupCiImages(rcData, traitName, antiCi, rdataFile)
  })
})
write.csv(exampleInfo, file.path(finalDir, "classification_image_examples.csv"), row.names = FALSE)

cat("\nSecondary OpenFace analysis complete.\n")
cat("final output folder: ", finalDir, "\n", sep = "")
cat("scatter graphs: ", length(list.files(scatterDir, pattern = "\\.png$")), "\n", sep = "")
cat("min/max images: ", length(minMaxFiles), "\n", sep = "")
cat("classification example images: ", length(list.files(exampleDir, pattern = "\\.png$")), "\n", sep = "")

