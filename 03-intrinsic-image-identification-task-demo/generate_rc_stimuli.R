## Java Helpers
find_java_tool <- function(name) {
  found <- Sys.which(name)
  if (nzchar(found)) {
    return(unname(found))
  }

  java_home <- Sys.getenv("JAVA_HOME")
  if (nzchar(java_home)) {
    candidate <- file.path(java_home, "bin", paste0(name, ".exe"))
    if (file.exists(candidate)) {
      return(candidate)
    }
  }

  candidates <- c(
    Sys.glob(file.path(Sys.getenv("ProgramFiles"), "Java", "*", "bin", paste0(name, ".exe"))),
    Sys.glob(file.path(Sys.getenv("ProgramFiles(x86)"), "Java", "*", "bin", paste0(name, ".exe")))
  )

  candidates <- candidates[file.exists(candidates)]
  if (length(candidates) > 0) {
    return(tail(sort(candidates), 1))
  }

  stop("Could not find ", name, ". Install Java and make sure it is available on PATH.")
}

## Command Helpers
run_command <- function(command, args) {
  quote_arg <- function(arg) {
    if (.Platform$OS.type == "windows" && grepl("[[:space:];]", arg)) {
      return(shQuote(arg, type = "cmd"))
    }
    arg
  }

  output <- system2(command, args = vapply(args, quote_arg, character(1)), stdout = TRUE, stderr = TRUE)
  status <- attr(output, "status")
  if (length(output) > 0) {
    cat(paste(output, collapse = "\n"), "\n")
  }
  if (!is.null(status) && status != 0) {
    stop("Command failed: ", command)
  }
}

## Packages
if (!requireNamespace("rcicr", quietly = TRUE)) {
  if (!requireNamespace("remotes", quietly = TRUE)) {
    install.packages("remotes", repos = "https://cloud.r-project.org")
  }
  remotes::install_github("rdotsch/rcicr", upgrade = "never")
}

library(rcicr)

## Paths
base_dir <- "images"
male_base <- file.path(base_dir, "Male_base.JPG")
female_base <- file.path(base_dir, "Female_base.JPG")
neutral_base <- file.path(base_dir, "rc_base_neutral_512.png")
stimulus_dir <- file.path(base_dir, "rc_stimuli")

psychomorph_dir <- file.path("tools", "psychomorph")
psychomorph_jar <- file.path(psychomorph_dir, "FaceMorphLib.jar")
psychomorph_source <- file.path(psychomorph_dir, "MakePsychomorphNeutralBase.java")
psychomorph_classes <- file.path(psychomorph_dir, "classes")
psychomorph_class <- file.path(psychomorph_classes, "MakePsychomorphNeutralBase.class")

## File Checks
if (!file.exists(male_base)) {
  stop("Missing male base image: ", male_base)
}

if (!file.exists(female_base)) {
  stop("Missing female base image: ", female_base)
}

if (!file.exists(psychomorph_jar)) {
  stop("Missing Psychomorph jar: ", psychomorph_jar)
}

if (!file.exists(psychomorph_source)) {
  stop("Missing Psychomorph Java source: ", psychomorph_source)
}

dir.create(psychomorph_classes, recursive = TRUE, showWarnings = FALSE)

## Java Compile
needs_compile <- !file.exists(psychomorph_class) ||
  file.info(psychomorph_source)$mtime > file.info(psychomorph_class)$mtime

if (needs_compile) {
  javac <- find_java_tool("javac")
  run_command(
    javac,
    c(
      "-cp",
      normalizePath(psychomorph_jar, winslash = "/", mustWork = TRUE),
      "-d",
      normalizePath(psychomorph_classes, winslash = "/", mustWork = FALSE),
      normalizePath(psychomorph_source, winslash = "/", mustWork = TRUE)
    )
  )
}

## Psychomorph Average
java <- find_java_tool("java")
classpath <- paste(
  normalizePath(psychomorph_classes, winslash = "/", mustWork = TRUE),
  normalizePath(psychomorph_jar, winslash = "/", mustWork = TRUE),
  sep = .Platform$path.sep
)

run_command(
  java,
  c(
    "-cp",
    classpath,
    "MakePsychomorphNeutralBase",
    normalizePath(male_base, winslash = "/", mustWork = TRUE),
    normalizePath(female_base, winslash = "/", mustWork = TRUE),
    normalizePath(neutral_base, winslash = "/", mustWork = FALSE)
  )
)

## Stimulus Folder
if (dir.exists(stimulus_dir)) {
  unlink(stimulus_dir, recursive = TRUE)
}
dir.create(stimulus_dir, recursive = TRUE, showWarnings = FALSE)

base_face_files <- list(
  neutral = neutral_base
)

## Stimulus Generation
generateStimuli2IFC(
  base_face_files = base_face_files,
  n_trials = 600,
  img_size = 512,
  stimulus_path = stimulus_dir,
  label = "rcic",
  use_same_parameters = TRUE,
  seed = 1,
  maximize_baseimage_contrast = TRUE,
  noise_type = "sinusoid",
  nscales = 5,
  ncores = 4,
  return_as_dataframe = FALSE,
  save_as_png = TRUE,
  save_rdata = TRUE
)
