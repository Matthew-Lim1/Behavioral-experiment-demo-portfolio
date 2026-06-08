<?php
$postData = json_decode(file_get_contents('php://input'), true);

// Save the CSV in the local data folder.
$fileName = "data/".$postData['filename'].".csv";
$fileData = $postData['filedata'];

file_put_contents($fileName, $fileData);
?>
