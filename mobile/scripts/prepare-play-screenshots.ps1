# Upscales phone screenshots to 1080x1920 for Google Play (9:16).
param(
  [string]$SourceDir,
  [string]$OutDir
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$targetW = 1080
$targetH = 1920

function Save-Upscaled($src, $dest) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $bmp = New-Object System.Drawing.Bitmap $targetW, $targetH
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $targetW, $targetH)
    $g.Dispose()
    if (Test-Path $dest) { Remove-Item $dest -Force }
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally {
    $img.Dispose()
  }
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$pairs = @(
  @{ Src = Join-Path $SourceDir "source-home.png"; Dest = Join-Path $OutDir "01-home.png" },
  @{ Src = Join-Path $SourceDir "source-multiplayer.png"; Dest = Join-Path $OutDir "02-multiplayer.png" },
  @{ Src = Join-Path $SourceDir "source-training.png"; Dest = Join-Path $OutDir "03-training.png" },
  @{ Src = Join-Path $SourceDir "source-game.png"; Dest = Join-Path $OutDir "04-game.png" }
)

foreach ($p in $pairs) {
  if (-not (Test-Path $p.Src)) { throw "Missing source: $($p.Src)" }
  Save-Upscaled $p.Src $p.Dest
  $kb = [math]::Round((Get-Item $p.Dest).Length / 1KB, 1)
  Write-Host "Created $($p.Dest) (${targetW}x${targetH}, ${kb} KB)"
}
