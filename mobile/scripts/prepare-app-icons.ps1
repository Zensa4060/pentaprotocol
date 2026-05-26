# Generates Expo launcher icons from the PentaProtocol transparent logo.
# Output: icon.png + adaptive-icon.png (1024x1024, Play-aligned).
param(
  [string]$Logo = "$PSScriptRoot\..\..\frontend\public\Pentaprotocol_Logo_Transparent.png",
  [string]$OutDir = "$PSScriptRoot\..\assets\images"
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$size = 1024
$logoPath = (Resolve-Path $Logo).Path
$outDir = (Resolve-Path $OutDir -ErrorAction SilentlyContinue)
if (-not $outDir) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  $outDir = (Resolve-Path $OutDir).Path
}

function Save-SquareIcon($src, $dest, [int]$canvas, [double]$scale) {
  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $bmp = New-Object System.Drawing.Bitmap $canvas, $canvas
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $pad = [int]($canvas * (1 - $scale) / 2)
    $inner = $canvas - 2 * $pad
    $g.DrawImage($img, $pad, $pad, $inner, $inner)
    $g.Dispose()
    if (Test-Path $dest) { Remove-Item $dest -Force }
    $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Wrote $dest"
  } finally {
    $img.Dispose()
  }
}

$icon = Join-Path $outDir "icon.png"
$adaptive = Join-Path $outDir "adaptive-icon.png"
Save-SquareIcon $logoPath $icon $size 0.82
Save-SquareIcon $logoPath $adaptive $size 0.72
