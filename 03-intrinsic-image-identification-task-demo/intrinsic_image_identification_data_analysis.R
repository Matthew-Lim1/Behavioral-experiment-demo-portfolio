## Packages
pkgs <- c("tidyverse", "gtools", "psych", "png", "rcicr", "conflicted")

if (!requireNamespace("rcicr", quietly = TRUE)) {
  if (!requireNamespace("remotes", quietly = TRUE)) {
    install.packages("remotes", repos = "https://cloud.r-project.org")
  }
  remotes::install_github("rdotsch/rcicr", upgrade = "never")
}

need <- pkgs[!pkgs %in% rownames(installed.packages())]
if (length(need) > 0) install.packages(need, repos = "https://cloud.r-project.org")

ok <- sapply(pkgs, require, character.only = TRUE)
if (!all(ok)) stop("Missing packages even after install(): ", paste(pkgs[!ok], collapse = ", "))

rm(list = setdiff(ls(), c("pkgs", "need", "ok")))

conflicted::conflict_prefer("select", "dplyr")
conflicted::conflict_prefer("filter", "dplyr")
conflicted::conflict_prefer("lag", "dplyr")

## Settings
baseDir <- getwd()
dataDir <- file.path(baseDir, "data")
stimulusDir <- file.path(baseDir, "images", "rc_stimuli")
baseImageLabel <- "neutral"
outputBaseDir <- file.path(baseDir, "outputs_intrinsic_image_identification")
attentionCutoff <- 0
includePartialFiles <- FALSE
minCellResponses <- 1
traitLevels <- c("lonely", "sad")
ciScaling <- "independent"
ciScalingConstant <- 0.1
nCores <- 1

## Output Folders
makeOutputDirs <- function(baseDir) {
  outDir <- file.path(baseDir, "outputs_tables")
  figDir <- file.path(baseDir, "outputs_plots", "figures")
  ciDir <- file.path(baseDir, "classification_images")
  participantCiDir <- file.path(baseDir, "participant_classification_images")
  dir.create(outDir, showWarnings = FALSE, recursive = TRUE)
  dir.create(figDir, showWarnings = FALSE, recursive = TRUE)
  dir.create(ciDir, showWarnings = FALSE, recursive = TRUE)
  dir.create(participantCiDir, showWarnings = FALSE, recursive = TRUE)
  list(outDir = outDir, figDir = figDir, ciDir = ciDir, participantCiDir = participantCiDir)
}

io <- makeOutputDirs(outputBaseDir)

## Save Helpers
saveGg <- function(p, fileName, w = 9, h = 6, dpi = 160) {
  fp <- file.path(io$figDir, fileName)
  ggplot2::ggsave(fp, plot = p, width = w, height = h, dpi = dpi)
  invisible(fp)
}

savePngPlot <- function(fileName, expr, w = 1100, h = 900, res = 140) {
  fp <- file.path(io$figDir, fileName)
  grDevices::png(fp, width = w, height = h, res = res)
  on.exit(grDevices::dev.off(), add = TRUE)
  eval(substitute(expr), envir = parent.frame())
  invisible(fp)
}

## Format Helpers
asNum <- function(x) {
  suppressWarnings(as.numeric(as.character(x)))
}

asChr <- function(x) {
  trimws(as.character(x))
}

sanitizeFileName <- function(x) {
  out <- gsub("[^A-Za-z0-9_-]+", "_", as.character(x))
  out <- gsub("_+", "_", out)
  out <- gsub("^_|_$", "", out)
  ifelse(nchar(out) == 0, "missing_id", out)
}

## Data Loading
readExperimentFolder <- function(folder, include_partial = FALSE) {
  files <- list.files(folder, pattern = "\\.csv$", full.names = TRUE)
  files <- files[!grepl("^interactions_", basename(files), ignore.case = TRUE)]
  if (!include_partial) {
    files <- files[!grepl("^partial_", basename(files), ignore.case = TRUE)]
  }
  if (length(files) == 0) stop("No participant CSV files found in: ", folder)

  datList <- lapply(files, function(fp) {
    x <- read.csv(fp, header = TRUE, stringsAsFactors = FALSE, check.names = FALSE)
    x$file_name <- basename(fp)
    x
  })

  ad <- do.call(gtools::smartbind, datList)
  ad$subj_id <- as.character(ad$subj_id)
  ad
}

## UCLA Scoring
scoreUclaTotal <- function(ad) {
  reverseItems <- c(1, 5, 6, 9, 10, 15, 16, 19, 20)
  uclaItemNames <- paste0("ucla", 1:20)

  ucla <- ad %>%
    dplyr::filter(test_part == "UCLA")

  if (nrow(ucla) == 0) stop("No UCLA rows found.")
  if (!("id" %in% names(ucla))) ucla$id <- NA
  if (!("button_pressed" %in% names(ucla))) ucla$button_pressed <- NA

  uclaWide <- ucla %>%
    dplyr::mutate(
      subj_id_clean = sub("^time_", "", as.character(subj_id)),
      q_from_stimulus = asNum(stringr::str_match(stimulus, "<p>(\\d+) / 20</p>")[, 2]),
      q_number = dplyr::coalesce(asNum(id), q_from_stimulus),
      raw_score = asNum(button_pressed)
    ) %>%
    dplyr::filter(!is.na(q_number), q_number >= 1, q_number <= 20, !is.na(raw_score)) %>%
    dplyr::mutate(
      scored = dplyr::if_else(q_number %in% reverseItems, 5 - raw_score, raw_score),
      item = paste0("ucla", q_number)
    ) %>%
    dplyr::group_by(subj_id, subj_id_clean, item) %>%
    dplyr::summarise(scored = dplyr::last(scored), .groups = "drop") %>%
    tidyr::pivot_wider(names_from = item, values_from = scored)

  for (nm in uclaItemNames) {
    if (!(nm %in% names(uclaWide))) uclaWide[[nm]] <- NA_real_
  }

  uclaWide <- uclaWide %>%
    dplyr::mutate(
      n_answered = rowSums(!is.na(as.data.frame(dplyr::pick(dplyr::all_of(uclaItemNames))))),
      ucla_total = rowSums(as.data.frame(dplyr::pick(dplyr::all_of(uclaItemNames))), na.rm = TRUE),
      ucla_mean = ucla_total / n_answered
    ) %>%
    dplyr::filter(n_answered == length(uclaItemNames))

  uclaMedian <- stats::median(uclaWide$ucla_total, na.rm = TRUE)

  uclaWide %>%
    dplyr::mutate(
      ucla_median = uclaMedian,
      ucla_group = dplyr::if_else(ucla_total >= uclaMedian, "high_ucla", "low_ucla")
    ) %>%
    dplyr::select(
      subj_id, subj_id_clean, dplyr::all_of(uclaItemNames), n_answered,
      ucla_total, ucla_mean, ucla_median, ucla_group
    )
}

## UCLA Factor Analysis
runUclaFactorAnalysis <- function(uclaScores) {
  uclaItemNames <- paste0("ucla", 1:20)
  uclaItemsWideFa <- uclaScores %>%
    dplyr::select(subj_id_clean, dplyr::all_of(uclaItemNames))

  uclaWideCompleteFa <- uclaItemsWideFa %>%
    dplyr::mutate(
      nAnswered = rowSums(!is.na(as.data.frame(dplyr::pick(dplyr::all_of(uclaItemNames))))),
      complete20 = nAnswered == 20
    ) %>%
    dplyr::filter(complete20)

  uclaMatNum <- uclaWideCompleteFa %>%
    dplyr::select(dplyr::all_of(uclaItemNames)) %>%
    as.data.frame()

  uclaMatNum[] <- lapply(uclaMatNum, function(x) suppressWarnings(as.numeric(x)))

  itemUnique <- sapply(uclaMatNum, function(x) length(unique(x[!is.na(x)])))
  keepItems <- names(itemUnique)[itemUnique >= 2]
  dropItems <- setdiff(names(itemUnique), keepItems)

  if (length(dropItems) > 0) {
    cat("Dropping UCLA items with <2 unique values: ", paste(dropItems, collapse = ", "), "\n", sep = "")
  }

  if (nrow(uclaMatNum) < 3 || length(keepItems) < 2) {
    faStatus <- tibble::tibble(
      status = "skipped",
      reason = "Need at least 3 complete participants and 2 varying UCLA items.",
      nObs = nrow(uclaMatNum),
      nItems = length(keepItems)
    )
    write.csv(faStatus, file.path(io$outDir, "FA_status.csv"), row.names = FALSE)
    return(list(auto_scores = tibble::tibble(), mr_scores = tibble::tibble()))
  }

  uclaMatNum <- uclaMatNum[, keepItems, drop = FALSE]
  uclaItemNames <- keepItems

  uclaMat <- uclaMatNum
  uclaMat[] <- lapply(uclaMat, function(x) factor(round(x), levels = 1:4, ordered = TRUE))

  cat("\nUCLA factor analysis (EFA)\n")
  cat("Subjects with all 20 UCLA items: ", nrow(uclaMat), "\n", sep = "")
  cat("UCLA items used in EFA: ", length(uclaItemNames), "\n", sep = "")

  savePngPlot("FA01_ucla_parallel_polychoric.png", {
    okPar <- tryCatch({
      psych::fa.parallel(uclaMat, fm = "minres", fa = "fa", cor = "poly", n.iter = 50, error.bars = FALSE)
      TRUE
    }, error = function(e) {
      cat("FA01 polychoric parallel failed: ", conditionMessage(e), "\n", sep = "")
      FALSE
    })
    if (!okPar) {
      psych::fa.parallel(uclaMatNum, fm = "minres", fa = "fa", n.iter = 50, error.bars = FALSE)
    }
  }, w = 1100, h = 800, res = 140)

  set.seed(1)
  rhoOut <- tryCatch(
    psych::polychoric(uclaMat, correct = 0.5),
    error = function(e) {
      cat("polychoric failed; falling back to Pearson: ", conditionMessage(e), "\n", sep = "")
      NULL
    }
  )

  rho <- if (is.null(rhoOut)) {
    cor(uclaMatNum, use = "pairwise.complete.obs")
  } else {
    rhoOut$rho
  }

  rho <- as.matrix(rho)
  badItems <- rownames(rho)[apply(is.na(rho), 1, any)]
  if (length(badItems) > 0) {
    cat("Dropping UCLA items with NA correlations: ", paste(badItems, collapse = ", "), "\n", sep = "")
    keep2 <- setdiff(colnames(rho), badItems)
    rho <- rho[keep2, keep2, drop = FALSE]
    uclaMat <- uclaMat[, keep2, drop = FALSE]
    uclaMatNum <- uclaMatNum[, keep2, drop = FALSE]
    uclaItemNames <- keep2
  }

  dimnames(rho) <- list(uclaItemNames, uclaItemNames)

  eigVals <- eigen(rho, only.values = TRUE)$values
  eigDf <- tibble::tibble(component = 1:length(eigVals), eigenvalue = eigVals)
  write.csv(eigDf, file.path(io$outDir, "FA00_ucla_polychoric_eigenvalues.csv"), row.names = FALSE)

  pScree <- ggplot2::ggplot(eigDf, ggplot2::aes(x = component, y = eigenvalue)) +
    ggplot2::geom_point(size = 2) +
    ggplot2::geom_line() +
    ggplot2::theme_bw() +
    ggplot2::labs(title = "UCLA polychoric scree plot", x = "Component", y = "Eigenvalue")

  saveGg(pScree, "FA02_ucla_scree_polychoric.png", w = 8, h = 5)

  fitEfa <- function(nFactors, prefix, loadingsFile, summaryFile, scoresFile, diagramFile, diagramTitle) {
    nFactors <- min(nFactors, max(1, ncol(rho) - 1))
    faFit <- tryCatch(
      psych::fa(rho, nfactors = nFactors, fm = "minres", rotate = "oblimin", n.obs = nrow(uclaMat)),
      error = function(e) {
        cat(prefix, " EFA failed: ", conditionMessage(e), "\n", sep = "")
        NULL
      }
    )

    if (is.null(faFit)) {
      write.csv(
        tibble::tibble(status = "failed", nfactors = nFactors),
        file.path(io$outDir, paste0(prefix, "_status.csv")),
        row.names = FALSE
      )
      return(tibble::tibble())
    }

    loadingsMat <- as.data.frame(unclass(faFit$loadings))
    loadingsMat$item <- rownames(loadingsMat)
    rownames(loadingsMat) <- NULL

    commVec <- as.numeric(faFit$communality)
    if (length(commVec) != nrow(loadingsMat)) commVec <- rep(NA_real_, nrow(loadingsMat))

    loadingsOut <- loadingsMat %>%
      dplyr::left_join(
        tibble::tibble(item = loadingsMat$item, communality = commVec, uniqueness = 1 - commVec),
        by = "item"
      ) %>%
      dplyr::relocate(item)

    write.csv(loadingsOut, file.path(io$outDir, loadingsFile), row.names = FALSE)

    faSummary <- tibble::tibble(
      nfactors = nFactors,
      nObs = nrow(uclaMat),
      rms = faFit$rms,
      rmsea = faFit$RMSEA[1],
      tli = faFit$TLI,
      bic = faFit$BIC
    )

    write.csv(faSummary, file.path(io$outDir, summaryFile), row.names = FALSE)

    savePngPlot(diagramFile, {
      psych::fa.diagram(faFit, main = diagramTitle)
    }, w = 1200, h = 900, res = 140)

    faScores <- tryCatch(
      psych::factor.scores(uclaMatNum, faFit, method = "tenBerge")$scores,
      error = function(e) {
        cat(prefix, " factor scoring failed: ", conditionMessage(e), "\n", sep = "")
        NULL
      }
    )

    if (is.null(faScores)) return(tibble::tibble())

    faScoresDf <- as.data.frame(faScores)
    faScoresDf$subj_id_clean <- uclaWideCompleteFa$subj_id_clean
    faScoresDf <- faScoresDf %>% dplyr::relocate(subj_id_clean)

    write.csv(faScoresDf, file.path(io$outDir, scoresFile), row.names = FALSE)
    faScoresDf
  }

  nFactors <- sum(eigVals > 1)
  if (is.na(nFactors) || nFactors < 1) nFactors <- 1
  if (nFactors > 8) nFactors <- 8
  if (nFactors > (ncol(rho) - 1)) nFactors <- max(1, ncol(rho) - 1)

  cat("Heuristic nfactors (eigenvalue > 1, capped): ", nFactors, "\n", sep = "")

  autoScores <- fitEfa(
    nFactors,
    "FA",
    "FA03_ucla_loadings_oblimin.csv",
    "FA04_ucla_fit_summary.csv",
    "FA06_ucla_factor_scores.csv",
    "FA05_ucla_diagram.png",
    paste0("UCLA EFA (minres, oblimin), nfactors=", nFactors)
  )

  list(auto_scores = autoScores)
}

## Subject Filters
makeSubjectFilters <- function(ad, uclaScores) {
  codes <- ad %>%
    dplyr::filter(test_part == "debrief") %>%
    dplyr::mutate(
      subj_id_clean = sub("^time_", "", as.character(subj_id)),
      resp_attention = asNum(resp_attention),
      resp_tired = if ("resp_tired" %in% names(dplyr::pick(dplyr::everything()))) {
        asNum(resp_tired)
      } else {
        NA_real_
      },
      time_minutes = asNum(time_elapsed) / 1000 / 60
    ) %>%
    dplyr::select(dplyr::any_of(c(
      "subj_id", "subj_id_clean", "file_name", "time_minutes", "resp_age", "resp_gender",
      "resp_attention", "resp_tired", "resp_expt", "resp_experience",
      "resp_lonely_identify", "resp_sad_identify", "resp_lonely_features",
      "resp_sad_features", "resp_strategy_change", "resp_other_strategies",
      "resp_problems", "resp_final", "completion_code"
    )))

  if (nrow(codes) == 0) {
    codes <- ad %>%
      dplyr::distinct(subj_id, file_name) %>%
      dplyr::mutate(
        subj_id_clean = sub("^time_", "", as.character(subj_id)),
        resp_attention = NA_real_,
        resp_tired = NA_real_,
        time_minutes = NA_real_
      )
  }

  codes %>%
    dplyr::left_join(uclaScores, by = c("subj_id", "subj_id_clean")) %>%
    dplyr::mutate(
      attention_pass = is.na(resp_attention) | resp_attention >= attentionCutoff,
      ucla_complete = !is.na(ucla_total),
      include_subject = attention_pass & ucla_complete
    )
}

## Trial Data
makeRcTrialData <- function(ad, subjectFilters) {
  needed <- c(
    "subj_id", "test_part", "task", "trait_condition", "block_index",
    "block_trial_index", "trial_index", "noise_id", "original_side",
    "left_noise_sign", "right_noise_sign", "response_side", "key_press",
    "no_response", "rcicr_response", "rt", "file_name"
  )

  for (nm in needed) {
    if (!(nm %in% names(ad))) ad[[nm]] <- NA
  }

  ad %>%
    dplyr::filter(test_part == "main_trial") %>%
    dplyr::mutate(
      subj_id_clean = sub("^time_", "", as.character(subj_id)),
      trait_condition = asChr(trait_condition),
      response_side = asChr(response_side),
      no_response = tolower(asChr(no_response)),
      noise_id = as.integer(asNum(noise_id)),
      left_noise_sign = as.integer(asNum(left_noise_sign)),
      right_noise_sign = as.integer(asNum(right_noise_sign)),
      rcicr_response = as.integer(asNum(rcicr_response)),
      rcicr_response = dplyr::case_when(
        rcicr_response %in% c(-1L, 1L) ~ rcicr_response,
        response_side == "left" ~ left_noise_sign,
        response_side == "right" ~ right_noise_sign,
        TRUE ~ NA_integer_
      ),
      rt = asNum(rt),
      block_index = as.integer(asNum(block_index)),
      block_trial_index = as.integer(asNum(block_trial_index)),
      trial_index = as.integer(asNum(trial_index)),
      responded = !is.na(rcicr_response) & rcicr_response %in% c(-1L, 1L) & no_response != "true"
    ) %>%
    dplyr::filter(
      trait_condition %in% traitLevels,
      !is.na(noise_id),
      noise_id >= 1,
      responded
    ) %>%
    dplyr::left_join(
      subjectFilters %>%
        dplyr::select(subj_id, subj_id_clean, include_subject, attention_pass, ucla_complete, ucla_total, ucla_group),
      by = c("subj_id", "subj_id_clean")
    ) %>%
    dplyr::filter(include_subject)
}

## Subject Summary
makeSubjectSummary <- function(rcData, subjectFilters) {
  rcSummary <- rcData %>%
    dplyr::group_by(subj_id, subj_id_clean, ucla_group, trait_condition) %>%
    dplyr::summarise(
      n_trials = dplyr::n(),
      original_selected = sum(rcicr_response == 1, na.rm = TRUE),
      inverted_selected = sum(rcicr_response == -1, na.rm = TRUE),
      prop_original_selected = mean(rcicr_response == 1, na.rm = TRUE),
      mean_rt = mean(rt, na.rm = TRUE),
      .groups = "drop"
    ) %>%
    tidyr::pivot_wider(
      names_from = trait_condition,
      values_from = c(n_trials, original_selected, inverted_selected, prop_original_selected, mean_rt),
      names_sep = "_"
    )

  subjectFilters %>%
    dplyr::left_join(rcSummary, by = c("subj_id", "subj_id_clean", "ucla_group"))
}

## Stimulus Metadata
findRdataFile <- function(stimulusDir) {
  rdataFiles <- list.files(stimulusDir, pattern = "\\.Rdata$", full.names = TRUE)
  if (length(rdataFiles) == 0) stop("No rcicr .Rdata file found in: ", stimulusDir)
  rdataFiles[order(file.info(rdataFiles)$mtime, decreasing = TRUE)][1]
}

## Classification Images
generateCellCi <- function(rcData, uclaGroup, traitCondition, rdataFile) {
  cellData <- rcData %>%
    dplyr::filter(ucla_group == uclaGroup, trait_condition == traitCondition)

  filename <- paste(uclaGroup, traitCondition, sep = "_")
  outFile <- file.path(io$ciDir, paste0("ci_", filename, ".png"))

  if (nrow(cellData) < minCellResponses) {
    return(list(
      ucla_group = uclaGroup,
      trait_condition = traitCondition,
      n_subjects = dplyr::n_distinct(cellData$subj_id_clean),
      n_responses = nrow(cellData),
      file = outFile,
      generated = FALSE,
      result = NULL
    ))
  }

  nSubjects <- dplyr::n_distinct(cellData$subj_id_clean)
  generateArgs <- list(
    stimuli = cellData$noise_id,
    responses = cellData$rcicr_response,
    baseimage = baseImageLabel,
    rdata = rdataFile,
    save_as_png = TRUE,
    filename = filename,
    targetpath = io$ciDir,
    antiCI = FALSE,
    scaling = ciScaling,
    scaling_constant = ciScalingConstant
  )

  if (nSubjects > 1) {
    generateArgs$participants <- cellData$subj_id_clean
    generateArgs$save_individual_cis <- FALSE
    generateArgs$n_cores <- nCores
  }

  result <- do.call(rcicr::generateCI, generateArgs)

  list(
    ucla_group = uclaGroup,
    trait_condition = traitCondition,
    n_subjects = nSubjects,
    n_responses = nrow(cellData),
    file = outFile,
    generated = file.exists(outFile),
    result = result
  )
}

generateParticipantCiImages <- function(rcData, rdataFile) {
  participantCells <- rcData %>%
    dplyr::filter(trait_condition %in% traitLevels) %>%
    dplyr::group_by(subj_id_clean, trait_condition) %>%
    dplyr::group_split()

  if (length(participantCells) == 0) {
    return(data.frame())
  }

  summaries <- lapply(participantCells, function(cellData) {
    subj <- unique(cellData$subj_id_clean)[1]
    trait <- unique(cellData$trait_condition)[1]
    fileStub <- paste(sanitizeFileName(subj), trait, sep = "_")
    ciFile <- file.path(io$participantCiDir, paste0(fileStub, "_CI.png"))
    antiCiFile <- file.path(io$participantCiDir, paste0(fileStub, "_anti_CI.png"))

    if (nrow(cellData) < minCellResponses) {
      return(data.frame(
        subj_id_clean = subj,
        trait_condition = trait,
        n_responses = nrow(cellData),
        ci_generated = FALSE,
        anti_ci_generated = FALSE,
        ci_file = ciFile,
        anti_ci_file = antiCiFile,
        stringsAsFactors = FALSE
      ))
    }

    ciResult <- rcicr::generateCI(
      stimuli = cellData$noise_id,
      responses = cellData$rcicr_response,
      baseimage = baseImageLabel,
      rdata = rdataFile,
      save_as_png = FALSE,
      antiCI = FALSE,
      scaling = ciScaling,
      scaling_constant = ciScalingConstant
    )

    antiCiResult <- rcicr::generateCI(
      stimuli = cellData$noise_id,
      responses = cellData$rcicr_response,
      baseimage = baseImageLabel,
      rdata = rdataFile,
      save_as_png = FALSE,
      antiCI = TRUE,
      scaling = ciScaling,
      scaling_constant = ciScalingConstant
    )

    png::writePNG(ciResult$combined, ciFile)
    png::writePNG(antiCiResult$combined, antiCiFile)

    data.frame(
      subj_id_clean = subj,
      trait_condition = trait,
      n_responses = nrow(cellData),
      ci_generated = file.exists(ciFile),
      anti_ci_generated = file.exists(antiCiFile),
      ci_file = ciFile,
      anti_ci_file = antiCiFile,
      stringsAsFactors = FALSE
    )
  })

  dplyr::bind_rows(summaries)
}

## Contrast Tables
makeContrastSummary <- function(cellSummary) {
  highLow <- cellSummary %>%
    dplyr::select(trait_condition, ucla_group, prop_original_selected) %>%
    tidyr::pivot_wider(names_from = ucla_group, values_from = prop_original_selected)

  for (nm in c("high_ucla", "low_ucla")) {
    if (!(nm %in% names(highLow))) highLow[[nm]] <- NA_real_
  }

  highLow <- highLow %>%
    dplyr::transmute(
      contrast_type = "high_minus_low_ucla",
      comparison = trait_condition,
      prop_original_selected_diff = high_ucla - low_ucla
    )

  lonelySad <- cellSummary %>%
    dplyr::select(ucla_group, trait_condition, prop_original_selected) %>%
    tidyr::pivot_wider(names_from = trait_condition, values_from = prop_original_selected)

  for (nm in traitLevels) {
    if (!(nm %in% names(lonelySad))) lonelySad[[nm]] <- NA_real_
  }

  lonelySad <- lonelySad %>%
    dplyr::transmute(
      contrast_type = "lonely_minus_sad",
      comparison = ucla_group,
      prop_original_selected_diff = lonely - sad
    )

  dplyr::bind_rows(highLow, lonelySad)
}

## Image Grid
drawCiGrid <- function(ciInfo, fileName = "2x2_classification_image_grid.png") {
  getCell <- function(uclaGroup, traitCondition) {
    idx <- which(vapply(ciInfo, function(x) x$ucla_group == uclaGroup && x$trait_condition == traitCondition, logical(1)))
    if (length(idx) == 0) return(NULL)
    ciInfo[[idx[1]]]
  }

  savePngPlot(fileName, {
    grid::grid.newpage()
    lay <- grid::grid.layout(
      nrow = 3,
      ncol = 3,
      widths = grid::unit(c(0.12, 0.44, 0.44), "npc"),
      heights = grid::unit(c(0.08, 0.46, 0.46), "npc")
    )
    grid::pushViewport(grid::viewport(layout = lay))

    grid::grid.text("Lonely prompt", vp = grid::viewport(layout.pos.row = 1, layout.pos.col = 2), gp = grid::gpar(fontface = "bold", cex = 1.1))
    grid::grid.text("Sad prompt", vp = grid::viewport(layout.pos.row = 1, layout.pos.col = 3), gp = grid::gpar(fontface = "bold", cex = 1.1))
    grid::grid.text("High UCLA", rot = 90, vp = grid::viewport(layout.pos.row = 2, layout.pos.col = 1), gp = grid::gpar(fontface = "bold", cex = 1.1))
    grid::grid.text("Low UCLA", rot = 90, vp = grid::viewport(layout.pos.row = 3, layout.pos.col = 1), gp = grid::gpar(fontface = "bold", cex = 1.1))

    cells <- list(
      list(row = 2, col = 2, group = "high_ucla", trait = "lonely"),
      list(row = 2, col = 3, group = "high_ucla", trait = "sad"),
      list(row = 3, col = 2, group = "low_ucla", trait = "lonely"),
      list(row = 3, col = 3, group = "low_ucla", trait = "sad")
    )

    for (cell in cells) {
      grid::pushViewport(grid::viewport(layout.pos.row = cell$row, layout.pos.col = cell$col))
      obj <- getCell(cell$group, cell$trait)
      if (!is.null(obj) && isTRUE(obj$generated) && file.exists(obj$file)) {
        img <- png::readPNG(obj$file)
        grid::grid.raster(img, interpolate = TRUE, width = grid::unit(0.92, "npc"), height = grid::unit(0.92, "npc"))
        grid::grid.text(
          paste0("n = ", obj$n_subjects, ", responses = ", obj$n_responses),
          y = grid::unit(0.04, "npc"),
          gp = grid::gpar(cex = 0.75, col = "#333333")
        )
      } else {
        grid::grid.rect(gp = grid::gpar(fill = "#f2f2f2", col = "#999999"))
        grid::grid.text("not generated", gp = grid::gpar(cex = 0.9, col = "#666666"))
      }
      grid::popViewport()
    }
    grid::popViewport()
  }, w = 1100, h = 1120, res = 150)
}

## Main Analysis
ad <- readExperimentFolder(dataDir, include_partial = includePartialFiles)
uclaScores <- scoreUclaTotal(ad)
subjectFilters <- makeSubjectFilters(ad, uclaScores)
uclaFactorAnalysis <- runUclaFactorAnalysis(uclaScores)

if (nrow(uclaFactorAnalysis$auto_scores) > 0) {
  uclaScores <- uclaScores %>%
    dplyr::left_join(uclaFactorAnalysis$auto_scores, by = "subj_id_clean")
  subjectFilters <- subjectFilters %>%
    dplyr::left_join(uclaFactorAnalysis$auto_scores, by = "subj_id_clean")
}

rcData <- makeRcTrialData(ad, subjectFilters)
subjectSummary <- makeSubjectSummary(rcData, subjectFilters)
rdataFile <- findRdataFile(stimulusDir)

write.csv(uclaScores, file.path(io$outDir, "ucla_scores.csv"), row.names = FALSE)
write.csv(subjectFilters, file.path(io$outDir, "subject_filters.csv"), row.names = FALSE)
write.csv(subjectSummary, file.path(io$outDir, "subject_summary.csv"), row.names = FALSE)
write.csv(rcData, file.path(io$outDir, "rc_trial_data.csv"), row.names = FALSE)

cellSummaryBeforeCi <- rcData %>%
  dplyr::group_by(ucla_group, trait_condition) %>%
  dplyr::summarise(
    n_subjects = dplyr::n_distinct(subj_id_clean),
    n_responses = dplyr::n(),
    prop_original_selected = mean(rcicr_response == 1, na.rm = TRUE),
    mean_rt = mean(rt, na.rm = TRUE),
    .groups = "drop"
  )

write.csv(cellSummaryBeforeCi, file.path(io$outDir, "cell_summary.csv"), row.names = FALSE)
write.csv(makeContrastSummary(cellSummaryBeforeCi), file.path(io$outDir, "cell_contrasts.csv"), row.names = FALSE)

pResponse <- cellSummaryBeforeCi %>%
  dplyr::mutate(
    trait_condition = factor(trait_condition, levels = traitLevels),
    ucla_group = factor(ucla_group, levels = c("high_ucla", "low_ucla"))
  ) %>%
  ggplot2::ggplot(ggplot2::aes(x = trait_condition, y = prop_original_selected, fill = ucla_group)) +
  ggplot2::geom_col(position = ggplot2::position_dodge(0.75), width = 0.7, color = "black") +
  ggplot2::coord_cartesian(ylim = c(0, 1)) +
  ggplot2::scale_fill_manual(values = c(high_ucla = "#4E79A7", low_ucla = "#F28E2B")) +
  ggplot2::theme_bw() +
  ggplot2::labs(x = "Prompt condition", y = "Proportion original noise selected", fill = "UCLA group")

saveGg(pResponse, "response_summary_by_cell.png", w = 8, h = 5)

ciInfo <- list(
  generateCellCi(rcData, "high_ucla", "lonely", rdataFile),
  generateCellCi(rcData, "high_ucla", "sad", rdataFile),
  generateCellCi(rcData, "low_ucla", "lonely", rdataFile),
  generateCellCi(rcData, "low_ucla", "sad", rdataFile)
)

ciSummary <- dplyr::bind_rows(lapply(ciInfo, function(x) {
  data.frame(
    ucla_group = x$ucla_group,
    trait_condition = x$trait_condition,
    n_subjects = x$n_subjects,
    n_responses = x$n_responses,
    generated = x$generated,
    file = x$file,
    stringsAsFactors = FALSE
  )
}))

write.csv(ciSummary, file.path(io$outDir, "classification_image_summary.csv"), row.names = FALSE)
drawCiGrid(ciInfo)

participantCiSummary <- generateParticipantCiImages(rcData, rdataFile)
write.csv(participantCiSummary, file.path(io$outDir, "participant_classification_image_summary.csv"), row.names = FALSE)

cat("\nIntrinsic image identification analysis complete.\n")
cat("participant csv rows: ", nrow(ad), "\n", sep = "")
cat("subjects with complete UCLA and attention pass: ", sum(subjectFilters$include_subject, na.rm = TRUE), "\n", sep = "")
cat("intrinsic image identification responses analyzed: ", nrow(rcData), "\n", sep = "")
cat("rcicr rdata file: ", rdataFile, "\n", sep = "")
cat("outputs root: ", outputBaseDir, "\n", sep = "")

