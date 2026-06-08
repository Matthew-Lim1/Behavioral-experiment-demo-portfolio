# Packages
pkgs <- c("tidyverse","psych","gtools","BGGM","igraph","conflicted")

need <- pkgs[!pkgs %in% rownames(installed.packages())]
if (length(need) > 0) install.packages(need)

ok <- sapply(pkgs, require, character.only = TRUE)
if (!all(ok)) stop("Missing packages even after install(): ", paste(pkgs[!ok], collapse = ", "))

rm(list = ls())

conflicted::conflict_prefer("select", "dplyr")
conflicted::conflict_prefer("filter", "dplyr")
conflicted::conflict_prefer("lag", "dplyr")

# Settings
attentionCutoff <- 90
minTrialsPerType <- 10
metricCred <- 0.95

# Samples
selectedSampleIds <- c(
  "DEMO_SAMPLE_ONE",
  "DEMO_SAMPLE_ONE_FILTERED",
  "DEMO_SAMPLE_TWO"
)

# Paths
projectDir <- getwd()
outputBaseDir <- file.path(projectDir, "output_memory_shape_name")
dir.create(outputBaseDir, showWarnings = FALSE, recursive = TRUE)
setwd(projectDir)

makeOutputDirs <- function(baseDir) {
  outDir <- file.path(baseDir, "outputs_plots")
  figDir <- file.path(outDir, "figures")
  dir.create(figDir, showWarnings = FALSE, recursive = TRUE)
  list(outDir = outDir, figDir = figDir)
}

io <- makeOutputDirs(outputBaseDir)

# Helpers
saveGg <- function(p, fileName, w = 9, h = 6, dpi = 160) {
  fp <- file.path(io$figDir, fileName)
  ggsave(fp, plot = p, width = w, height = h, dpi = dpi)
  invisible(fp)
}

savePngPlot <- function(fileName, expr, w = 1100, h = 800, res = 140) {
  fp <- file.path(io$figDir, fileName)
  png(fp, width = w, height = h, res = res)
  on.exit(dev.off(), add = TRUE)
  eval(substitute(expr), envir = parent.frame())
  invisible(fp)
}

as01 <- function(x) {
  xs <- tolower(trimws(as.character(x)))
  out <- ifelse(xs %in% c("true", "t", "1", "yes", "y"), 1L,
    ifelse(xs %in% c("false", "f", "0", "no", "n"), 0L, NA_integer_))
  as.integer(out)
}

safeDiv <- function(num, den, eps = 1e-8) {
  out <- ifelse(is.na(num) | is.na(den) | abs(den) < eps, NA_real_, num / den)
  as.numeric(out)
}

# Signal detection
rateFix <- function(p, n) {
  ifelse(p <= 0, 0.5 / n, ifelse(p >= 1, (n - 0.5) / n, p))
}

dprimeFromCounts <- function(hit, miss, fa, cr) {
  n_signal <- hit + miss
  n_noise <- fa + cr
  if (n_signal <= 0 || n_noise <= 0) return(NA_real_)
  hit_rate <- hit / n_signal
  fa_rate <- fa / n_noise
  hit_corr <- rateFix(hit_rate, n_signal)
  fa_corr <- rateFix(fa_rate, n_noise)
  qnorm(hit_corr) - qnorm(fa_corr)
}

# Network plotting
plotBggmSelectedNetwork <- function(E, titleText = NULL, layoutName = "circle",
                                    posCol = "darkgreen", negCol = "orange",
                                    nodeSize = 12, edgeScale = 5, labelCex = 0.9) {
  W <- E$pcor_adj
  if (is.null(W)) stop("E$pcor_adj not found.")

  W <- as.matrix(W)
  W[is.na(W)] <- 0
  diag(W) <- 0
  W <- (W + t(W)) / 2

  if (is.null(colnames(W))) colnames(W) <- paste0("V", seq_len(ncol(W)))
  if (is.null(rownames(W))) rownames(W) <- colnames(W)

  g <- igraph::graph_from_adjacency_matrix(W, mode = "undirected", weighted = TRUE, diag = FALSE)
  w <- igraph::E(g)$weight

  igraph::E(g)$color <- ifelse(w >= 0, posCol, negCol)
  igraph::E(g)$width <- pmax(edgeScale * abs(w), 0.3)

  coords <- switch(layoutName,
    circle = igraph::layout_in_circle(g),
    fr = igraph::layout_with_fr(g),
    kk = igraph::layout_with_kk(g),
    nicely = igraph::layout_nicely(g),
    igraph::layout_in_circle(g))

  graphics::plot(g,
    layout = coords,
    vertex.size = nodeSize,
    vertex.label = igraph::V(g)$name,
    vertex.label.cex = labelCex,
    vertex.color = "white",
    vertex.frame.color = "black",
    edge.curved = 0.10)

  if (!is.null(titleText)) graphics::title(main = titleText)
  invisible(g)
}

# Sample files
parseExternalSourceFiles <- function(folder) {
  externalListPath <- file.path(folder, "external_source_files.txt")
  if (!file.exists(externalListPath)) return(character(0))

  lines <- readLines(externalListPath, warn = FALSE, encoding = "UTF-8")
  out <- stringr::str_extract(lines, "time_\\S+?\\.csv")
  unique(out[!is.na(out)])
}

sampleOneDir <- file.path(projectDir, "DEMO_SAMPLE_ONE")
sampleTwoDir <- file.path(projectDir, "DEMO_SAMPLE_TWO")

externalFilesSampleOne <- parseExternalSourceFiles(sampleOneDir)
allSampleOneFiles <- list.files(sampleOneDir, pattern = "\\.csv$", full.names = FALSE)
filteredSampleOneFiles <- setdiff(allSampleOneFiles, externalFilesSampleOne)
allSampleTwoFiles <- list.files(sampleTwoDir, pattern = "\\.csv$", full.names = FALSE)

sampleConfigs <- list(
  list(
    sample_id = "DEMO_SAMPLE_ONE",
    sample_label = "demo sample one",
    folder = sampleOneDir,
    include_files = allSampleOneFiles,
    external_files = externalFilesSampleOne,
    expected_raw_n = length(allSampleOneFiles),
    output_dir = file.path(outputBaseDir, "DEMO_SAMPLE_ONE", "all")
  ),
  list(
    sample_id = "DEMO_SAMPLE_ONE_FILTERED",
    sample_label = "demo sample one filtered",
    folder = sampleOneDir,
    include_files = filteredSampleOneFiles,
    external_files = externalFilesSampleOne,
    expected_raw_n = length(filteredSampleOneFiles),
    output_dir = file.path(outputBaseDir, "DEMO_SAMPLE_ONE", "filtered")
  ),
  list(
    sample_id = "DEMO_SAMPLE_TWO",
    sample_label = "demo sample two",
    folder = sampleTwoDir,
    include_files = allSampleTwoFiles,
    external_files = character(0),
    expected_raw_n = length(allSampleTwoFiles),
    output_dir = file.path(outputBaseDir, "DEMO_SAMPLE_TWO")
  )
)

sampleConfigs <- Filter(function(x) x$sample_id %in% selectedSampleIds, sampleConfigs)
if (length(sampleConfigs) == 0) stop("No sample configs matched selectedSampleIds.")

# Data loading
readSampleFolder <- function(folder, include_files = NULL, external_files = character(0)) {
  files <- list.files(folder, pattern = "\\.csv$", full.names = TRUE)

  if (!is.null(include_files)) {
    include_base <- basename(include_files)
    files <- files[basename(files) %in% include_base]
  }

  if (length(files) == 0) stop("No CSV files found in: ", folder)

  datList <- lapply(files, function(fp) {
    x <- read.csv(fp, header = TRUE, stringsAsFactors = FALSE)
    x$file_name <- basename(fp)
    x$pool <- ifelse(x$file_name %in% external_files, "external_source", "demo_source")
    x
  })

  ad <- do.call(gtools::smartbind, datList)
  ad$subj_id <- as.character(ad$subj_id)

  list(ad = ad, raw_files = basename(files))
}
# Trial data
makeTestData <- function(ad, keepSubjects) {
  ad %>%
    dplyr::filter(test_part == "main_trial", subj_id %in% keepSubjects) %>%
    dplyr::filter(!("phase" %in% names(.)) | phase == "main") %>%
    dplyr::select(dplyr::any_of(c(
      "subj_id", "shape_owner", "is_match", "no_response", "correct", "rt"
    ))) %>%
    dplyr::mutate(
      subj_id_clean = sub("^time_", "", as.character(subj_id)),
      shape_owner = tolower(as.character(shape_owner)),
      shape_owner = dplyr::if_else(shape_owner %in% c("self", "me"), "you", shape_owner),
      is_match = tolower(as.character(is_match)),
      no_response = tolower(as.character(no_response)),
      correct01 = as01(correct),
      isMatch01 = as01(is_match),
      noResp01 = as01(no_response),
      rt = suppressWarnings(as.numeric(rt))
    )
}

# Owner metrics
computeOwnerMetrics <- function(testData, min_trials = 10) {
  owners <- c("you", "friend", "stranger")

  metricLong <- testData %>%
    dplyr::filter(noResp01 != 1, !is.na(isMatch01), !is.na(correct01), shape_owner %in% owners) %>%
    dplyr::mutate(
      respondedMatch01 = dplyr::case_when(
        correct01 == 1 ~ isMatch01,
        correct01 == 0 ~ 1L - isMatch01,
        TRUE ~ NA_integer_
      )
    ) %>%
    dplyr::group_by(subj_id_clean, shape_owner) %>%
    dplyr::summarise(
      hit = sum(isMatch01 == 1 & respondedMatch01 == 1, na.rm = TRUE),
      miss = sum(isMatch01 == 1 & respondedMatch01 == 0, na.rm = TRUE),
      false_alarm = sum(isMatch01 == 0 & respondedMatch01 == 1, na.rm = TRUE),
      correct_rej = sum(isMatch01 == 0 & respondedMatch01 == 0, na.rm = TRUE),
      n_match = sum(isMatch01 == 1, na.rm = TRUE),
      n_mismatch = sum(isMatch01 == 0, na.rm = TRUE),
      .groups = "drop"
    ) %>%
    dplyr::filter(n_match >= min_trials, n_mismatch >= min_trials) %>%
    dplyr::mutate(
      hit_rate = safeDiv(hit, n_match),
      false_alarm_rate = safeDiv(false_alarm, n_mismatch),
      correct_rejection_rate = safeDiv(correct_rej, n_mismatch),
      corrected_hitrate_bias = hit_rate - false_alarm_rate,
      raw_bias = hit_rate - correct_rejection_rate,
      dprime = mapply(dprimeFromCounts, hit, miss, false_alarm, correct_rej)
    )

  metricWide <- metricLong %>%
    dplyr::select(
      subj_id_clean,
      shape_owner,
      dprime,
      corrected_hitrate_bias,
      raw_bias,
      hit_rate,
      false_alarm_rate
    ) %>%
    tidyr::pivot_wider(
      names_from = shape_owner,
      values_from = c(dprime, corrected_hitrate_bias, raw_bias, hit_rate, false_alarm_rate),
      names_sep = "_"
    )

  neededPrefixes <- c("dprime", "corrected_hitrate_bias", "raw_bias", "hit_rate", "false_alarm_rate")
  for (pref in neededPrefixes) {
    for (owner in owners) {
      colName <- paste(pref, owner, sep = "_")
      if (!(colName %in% names(metricWide))) metricWide[[colName]] <- NA_real_
    }
  }

  list(long = metricLong, wide = metricWide)
}

# Factor analysis
scoreUclaFactors <- function(ad, keepSubjects) {
  reverseItems <- c(1, 5, 6, 9, 10, 15, 16, 19, 20)
  uclaItemNames <- paste0("ucla", 1:20)

  uclaWide <- ad %>%
    dplyr::filter(test_part == "UCLA", subj_id %in% keepSubjects) %>%
    dplyr::mutate(
      subj_id_clean = sub("^time_", "", as.character(subj_id)),
      q_number = suppressWarnings(as.numeric(stringr::str_match(stimulus, "<p>(\\d+) / 20</p>")[, 2])),
      raw_score = suppressWarnings(as.numeric(button_pressed))
    ) %>%
    dplyr::filter(!is.na(q_number), q_number >= 1, q_number <= 20, !is.na(raw_score)) %>%
    dplyr::mutate(
      scored = dplyr::if_else(q_number %in% reverseItems, 5 - raw_score, raw_score),
      item = paste0("ucla", q_number)
    ) %>%
    dplyr::group_by(subj_id_clean, item) %>%
    dplyr::summarise(scored = dplyr::last(scored), .groups = "drop") %>%
    tidyr::pivot_wider(names_from = item, values_from = scored)

  for (nm in uclaItemNames) {
    if (!(nm %in% names(uclaWide))) uclaWide[[nm]] <- NA_real_
  }

  uclaWide <- uclaWide %>%
    dplyr::select(subj_id_clean, dplyr::all_of(uclaItemNames))

  uclaWideComplete <- uclaWide %>%
    dplyr::mutate(n_answered = rowSums(!is.na(as.data.frame(dplyr::pick(dplyr::all_of(uclaItemNames)))))) %>%
    dplyr::filter(n_answered == length(uclaItemNames))

  uclaMatNum <- uclaWideComplete %>%
    dplyr::select(dplyr::all_of(uclaItemNames)) %>%
    as.data.frame()

  uclaMatNum[] <- lapply(uclaMatNum, function(x) suppressWarnings(as.numeric(x)))

  itemU <- sapply(uclaMatNum, function(x) length(unique(x[!is.na(x)])))
  keepItems <- names(itemU)[itemU >= 2]
  if (length(keepItems) < 4) stop("Fewer than 4 UCLA items had usable variation for factor analysis.")

  uclaMatNum <- uclaMatNum[, keepItems, drop = FALSE]
  uclaMatOrd <- uclaMatNum
  uclaMatOrd[] <- lapply(uclaMatOrd, function(x) factor(round(x), levels = 1:4, ordered = TRUE))

  rhoOut <- tryCatch(
    psych::polychoric(uclaMatOrd, correct = 0.5),
    error = function(e) NULL
  )

  rho <- if (is.null(rhoOut)) {
    cor(uclaMatNum, use = "pairwise.complete.obs")
  } else {
    rhoOut$rho
  }

  rho <- as.matrix(rho)
  bad <- rownames(rho)[apply(is.na(rho), 1, any)]
  if (length(bad) > 0) {
    keep2 <- setdiff(colnames(rho), bad)
    rho <- rho[keep2, keep2, drop = FALSE]
    uclaMatNum <- uclaMatNum[, keep2, drop = FALSE]
  }

  faFit <- psych::fa(rho, nfactors = 3, fm = "minres", rotate = "oblimin", n.obs = nrow(uclaMatNum))
  mrScores <- psych::factor.scores(uclaMatNum, faFit, method = "tenBerge")$scores
  mrScores <- as.data.frame(mrScores)
  mrScores$subj_id_clean <- uclaWideComplete$subj_id_clean

  for (nm in c("MR1", "MR2", "MR3")) {
    if (!(nm %in% names(mrScores))) mrScores[[nm]] <- NA_real_
  }

  mrScores %>%
    dplyr::select(subj_id_clean, MR1, MR2, MR3)
}

# Network analysis
runBggmBundle <- function(subjectData, metric_cols, metric_label, file_stub, sample_id, sample_label) {
  varsUse <- c("MR1", "MR2", "MR3", metric_cols)
  labelsUse <- c(
    MR1 = "MR1",
    MR2 = "MR2",
    MR3 = "MR3",
    setNames(c("You", "Friend", "Stranger"), metric_cols)
  )

  dat <- subjectData %>%
    dplyr::select(dplyr::all_of(varsUse)) %>%
    tidyr::drop_na()

  if (nrow(dat) < 10) {
    cat(sample_id, " ", file_stub, ": skipped because complete-case n < 10\n", sep = "")
    return(invisible(NULL))
  }

  uniq_n <- sapply(dat, function(x) dplyr::n_distinct(x, na.rm = TRUE))
  keep_cols <- names(uniq_n)[uniq_n >= 2]
  dat <- dat[, keep_cols, drop = FALSE]

  if (ncol(dat) < 3) {
    cat(sample_id, " ", file_stub, ": skipped because fewer than 3 varying columns remain\n", sep = "")
    return(invisible(NULL))
  }

  colnames(dat) <- unname(labelsUse[keep_cols])

  set.seed(1)
  fit <- tryCatch(BGGM::estimate(dat, type = "continuous"), error = function(e) e)
  if (inherits(fit, "error")) {
    cat(sample_id, " ", file_stub, ": BGGM failed -> ", fit$message, "\n", sep = "")
    return(invisible(NULL))
  }

  sumFit <- summary(fit, cred = metricCred)

  savePngPlot(paste0(sample_id, "_MR_", file_stub, "_edge_summary.png"), {
    pTmp <- plot(sumFit)
    if (inherits(pTmp, "ggplot")) {
      pTmp <- pTmp +
        ggplot2::ggtitle(paste0(sample_label, ", attention >= ", attentionCutoff, "\n", metric_label, " edge summary")) +
        ggplot2::coord_flip() +
        ggplot2::labs(x = NULL, y = "Posterior mean (95% CrI)") +
        ggplot2::theme(axis.text.y = ggplot2::element_text(size = 7))
      print(pTmp)
    } else {
      graphics::title(main = paste0(sample_label, ", attention >= ", attentionCutoff, "\n", metric_label, " edge summary"))
    }
  }, w = 1200, h = 700, res = 140)

  selFit <- BGGM::select(fit, cred = metricCred)
  if (!is.null(selFit$pcor_adj)) {
    dimnames(selFit$pcor_adj) <- list(colnames(dat), colnames(dat))
  }

  savePngPlot(paste0(sample_id, "_MR_", file_stub, "_selected_network.png"), {
    plotBggmSelectedNetwork(
      selFit,
      titleText = paste0(sample_label, ", attention >= ", attentionCutoff, "\n", metric_label, " selected network"),
      layoutName = "circle",
      posCol = "darkgreen",
      negCol = "orange",
      nodeSize = 12,
      edgeScale = 5
    )
  }, w = 1200, h = 850, res = 140)

  if (!is.null(selFit$pcor_adj)) {
    W <- as.matrix(selFit$pcor_adj)
    diag(W) <- 0
    W[upper.tri(W, diag = TRUE)] <- NA
    edgeTbl <- as.data.frame(as.table(W)) %>%
      dplyr::rename(from = Var1, to = Var2, pcor_adj = Freq) %>%
      tidyr::drop_na() %>%
      dplyr::arrange(dplyr::desc(abs(pcor_adj)))

    write.csv(
      edgeTbl,
      file.path(io$outDir, paste0(sample_id, "_MR_", file_stub, "_edge_table.csv")),
      row.names = FALSE
    )
  }

  invisible(NULL)
}

# Hit and false alarm scatterplots
makeHitFaScatter <- function(metricLong, sample_id, sample_label, owner) {
  ownerCols <- c(you = "#0B6E4F", friend = "#B75D2A", stranger = "#3A5F8A")
  ownerFills <- c(you = "#8FD0BC", friend = "#E9B08A", stranger = "#A9BEDD")

  dat <- metricLong %>%
    dplyr::filter(shape_owner == owner) %>%
    tidyr::drop_na(hit_rate, false_alarm_rate)

  if (nrow(dat) < 3) {
    cat(sample_id, ": skipped HR vs FAR for ", owner, " because n < 3\n", sep = "")
    return(invisible(NULL))
  }

  fitLm <- lm(hit_rate ~ false_alarm_rate, data = dat)
  fitStats <- summary(fitLm)
  ownerTitle <- tools::toTitleCase(owner)

  p <- ggplot(dat, aes(x = false_alarm_rate, y = hit_rate)) +
    geom_abline(intercept = 0, slope = 1, linetype = "dashed", linewidth = 0.7, color = "#BDBDBD") +
    geom_point(shape = 16, size = 3.2, color = ownerCols[[owner]], alpha = 0.45) +
    geom_smooth(method = "lm", formula = y ~ x, se = TRUE, linewidth = 1.15,
      color = ownerCols[[owner]], fill = ownerFills[[owner]], alpha = 0.22) +
    coord_equal(xlim = c(0, 1), ylim = c(0, 1), expand = FALSE) +
    scale_x_continuous(breaks = seq(0, 1, by = 0.2)) +
    scale_y_continuous(breaks = seq(0, 1, by = 0.2)) +
    labs(
      title = paste0(sample_label, ", attention >= ", attentionCutoff, "\n", ownerTitle, " hit rate vs false alarm rate"),
      subtitle = paste0("n = ", nrow(dat), " | R^2 = ", formatC(fitStats$r.squared, format = "f", digits = 2)),
      x = "False Alarm Rate",
      y = "Hit Rate"
    ) +
    theme_minimal(base_size = 14) +
    theme(
      plot.title = ggplot2::element_text(size = 16, face = "bold", colour = "#222222", lineheight = 1.05),
      plot.subtitle = ggplot2::element_text(size = 11.5, colour = "#555555"),
      axis.title = ggplot2::element_text(size = 13, face = "bold", colour = "#222222"),
      axis.text = ggplot2::element_text(size = 11, colour = "#333333"),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major = ggplot2::element_line(colour = "#E4E4E4", linewidth = 0.45),
      legend.position = "none"
    )

  saveGg(p, paste0(sample_id, "_HR_vs_FA_", owner, ".png"), w = 7, h = 6)
  invisible(NULL)
}

# Sample run
runSample <- function(config) {
  cat("\n==============================\n")
  cat("running sample: ", config$sample_label, "\n", sep = "")
  io <<- makeOutputDirs(config$output_dir)

  sampleRead <- readSampleFolder(
    folder = config$folder,
    include_files = config$include_files,
    external_files = config$external_files
  )

  ad <- sampleRead$ad
  rawFiles <- sampleRead$raw_files
  # Filtering
  codes <- ad %>%
    dplyr::filter(test_part == "debrief") %>%
    dplyr::mutate(resp_attention = suppressWarnings(as.numeric(resp_attention)))

  keepSubjects <- codes %>%
    dplyr::filter(!is.na(resp_attention), resp_attention >= attentionCutoff) %>%
    dplyr::pull(subj_id) %>%
    unique()

  testData <- makeTestData(ad, keepSubjects)
  ownerMetrics <- computeOwnerMetrics(testData, min_trials = minTrialsPerType)
  mrScores <- scoreUclaFactors(ad, keepSubjects)
  # Combine subject metrics
  subjectData <- ownerMetrics$wide %>%
    dplyr::left_join(mrScores, by = "subj_id_clean")

  cat("raw files: ", length(rawFiles), "\n", sep = "")
  cat("attention pass: ", length(keepSubjects), "\n", sep = "")
  cat("owner metric rows: ", nrow(ownerMetrics$wide), "\n", sep = "")
  cat("mr score rows: ", nrow(mrScores), "\n", sep = "")
  if (!is.null(config$expected_raw_n) && length(rawFiles) != config$expected_raw_n) {
    cat("expected raw files: ", config$expected_raw_n, "\n", sep = "")
  }
  # Network loop
  metricSpecs <- list(
    list(
      file_stub = "DPRIME",
      metric_label = "d-prime",
      metric_cols = c("dprime_you", "dprime_friend", "dprime_stranger")
    ),
    list(
      file_stub = "CORRECTED",
      metric_label = "corrected hit-rate bias",
      metric_cols = c("corrected_hitrate_bias_you", "corrected_hitrate_bias_friend", "corrected_hitrate_bias_stranger")
    ),
    list(
      file_stub = "RAWBIAS",
      metric_label = "raw bias",
      metric_cols = c("raw_bias_you", "raw_bias_friend", "raw_bias_stranger")
    ), # Hit and false alarm scatterplots
    list(
      file_stub = "HITRATE",
      metric_label = "hit rate",
      metric_cols = c("hit_rate_you", "hit_rate_friend", "hit_rate_stranger")
    ),
    list(
      file_stub = "FARATE",
      metric_label = "false alarm rate",
      metric_cols = c("false_alarm_rate_you", "false_alarm_rate_friend", "false_alarm_rate_stranger")
    )
  )

  for (spec in metricSpecs) {
    runBggmBundle(
      subjectData = subjectData,
      metric_cols = spec$metric_cols,
      metric_label = spec$metric_label,
      file_stub = spec$file_stub,
      sample_id = config$sample_id,
      sample_label = config$sample_label
    )
  }

  for (owner in c("you", "friend", "stranger")) {
    makeHitFaScatter(ownerMetrics$long, config$sample_id, config$sample_label, owner)
  }
}

# Main pipeline
for (config in sampleConfigs) {
  runSample(config)
}

cat("\noutputs root:\n", outputBaseDir, "\n", sep = "")



