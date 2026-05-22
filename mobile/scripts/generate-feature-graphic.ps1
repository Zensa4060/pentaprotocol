# Generates Google Play feature graphic (1024x500) for PentaProtocol.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

$outPath = Join-Path $repoRoot "mobile\assets\images\feature-graphic.png"
$logoPath = Join-Path $repoRoot "frontend\public\Pentaprotocol_Logo_Transparent.png"
$bgPath = Join-Path $repoRoot "frontend\public\bg-galaxy.png"

$w = 1024
$h = 500

$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Background: cover-crop galaxy
$bg = [System.Drawing.Image]::FromFile($bgPath)
try {
  $scale = [Math]::Max($w / $bg.Width, $h / $bg.Height)
  $dw = [int]($bg.Width * $scale)
  $dh = [int]($bg.Height * $scale)
  $dx = ($w - $dw) / 2
  $dy = ($h - $dh) / 2
  $g.DrawImage($bg, $dx, $dy, $dw, $dh)
} finally {
  $bg.Dispose()
}

# Dark vignette overlay
$overlay = New-Object System.Drawing.Drawing2D.LinearGradientBrush (
  [System.Drawing.Rectangle]::FromLTRB(0, 0, $w, $h),
  [System.Drawing.Color]::FromArgb(200, 5, 5, 12),
  [System.Drawing.Color]::FromArgb(230, 0, 0, 0),
  0
)
$g.FillRectangle($overlay, 0, 0, $w, $h)
$overlay.Dispose()

# Left accent bar
$accentBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 204, 0, 0))
$g.FillRectangle($accentBrush, 0, 0, 6, $h)
$accentBrush.Dispose()

# Logo
$logo = [System.Drawing.Image]::FromFile($logoPath)
try {
  $logoSize = 300
  $logoX = 72
  $logoY = ($h - $logoSize) / 2
  $g.DrawImage($logo, $logoX, $logoY, $logoSize, $logoSize)
} finally {
  $logo.Dispose()
}

# Title fonts
$fontPenta = [System.Drawing.Font]::new("Courier New", 52, [System.Drawing.FontStyle]::Bold)
$fontProto = [System.Drawing.Font]::new("Courier New", 52, [System.Drawing.FontStyle]::Bold)
$textX = 400
$textY = 155

$brushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 240, 240, 245))
$brushRed = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 34, 0))
$g.DrawString("PENTA", $fontPenta, $brushWhite, $textX, $textY)
$pentaSize = $g.MeasureString("PENTA", $fontPenta)
$g.DrawString("PROTOCOL", $fontProto, $brushRed, $textX, $textY + $pentaSize.Height - 8)

$brushWhite.Dispose()
$brushRed.Dispose()
$fontPenta.Dispose()
$fontProto.Dispose()

$g.Dispose()

$dir = Split-Path $outPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
if (Test-Path $outPath) { Remove-Item $outPath -Force }
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$info = Get-Item $outPath
$kb = [math]::Round($info.Length / 1KB, 1)
Write-Host "Created $outPath ($w x $h, ${kb} KB)"
