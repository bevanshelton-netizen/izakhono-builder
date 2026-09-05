#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$root = Join-Path $env:LOCALAPPDATA "IzakhonoWork"
New-Item -ItemType Directory -Force -Path $root | Out-Null

Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$black = [System.Drawing.Color]::FromArgb(255, 5, 6, 12)
$gold = [System.Drawing.Color]::FromArgb(255, 255, 215, 0)
$orange = [System.Drawing.Color]::FromArgb(255, 255, 90, 0)
$pink = [System.Drawing.Color]::FromArgb(255, 255, 0, 170)
$blue = [System.Drawing.Color]::FromArgb(255, 0, 200, 255)
$green = [System.Drawing.Color]::FromArgb(255, 45, 255, 80)
$white = [System.Drawing.Color]::White

$g.Clear($black)

$borderColors = @($gold, $orange, $pink, $blue)
for ($i=0; $i -lt $borderColors.Count; $i++) {
  $pen = New-Object System.Drawing.Pen($borderColors[$i], 4)
  $inset = 5 + ($i * 5)
  $g.DrawRectangle($pen, $inset, $inset, $size - (2*$inset) - 1, $size - (2*$inset) - 1)
  $pen.Dispose()
}

$brushGreen = New-Object System.Drawing.SolidBrush($green)
$brushGold = New-Object System.Drawing.SolidBrush($gold)
$brushBlue = New-Object System.Drawing.SolidBrush($blue)

$g.FillPolygon($brushGreen, @(
  (New-Object System.Drawing.Point 22,190),
  (New-Object System.Drawing.Point 66,48),
  (New-Object System.Drawing.Point 108,190)
))
$g.FillPolygon($brushGold, @(
  (New-Object System.Drawing.Point 76,190),
  (New-Object System.Drawing.Point 128,38),
  (New-Object System.Drawing.Point 180,190)
))
$g.FillPolygon($brushBlue, @(
  (New-Object System.Drawing.Point 145,190),
  (New-Object System.Drawing.Point 194,50),
  (New-Object System.Drawing.Point 234,190)
))

$font = New-Object System.Drawing.Font("Arial Black", 64, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$labelFont = New-Object System.Drawing.Font("Arial", 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$whiteBrush = New-Object System.Drawing.SolidBrush($white)
$blackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)

$iw = "IW"
$iwSize = $g.MeasureString($iw, $font)
$x = ($size - $iwSize.Width) / 2
$y = 68
$g.DrawString($iw, $font, $blackBrush, $x+3, $y+3)
$g.DrawString($iw, $font, $whiteBrush, $x, $y)

$label = "IZAKHONO"
$labelSize = $g.MeasureString($label, $labelFont)
$g.DrawString($label, $labelFont, $whiteBrush, (($size-$labelSize.Width)/2), 207)

$iconPath = Join-Path $root "IZAKHONO-WORK-LOUD.ico"
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$stream = [System.IO.File]::Open($iconPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "IZAKHONO WORK.url"

@"
[InternetShortcut]
URL=http://127.0.0.1:9393
IconFile=$iconPath
IconIndex=0
"@ | Set-Content -Path $shortcut -Encoding ASCII

$brushGreen.Dispose()
$brushGold.Dispose()
$brushBlue.Dispose()
$whiteBrush.Dispose()
$blackBrush.Dispose()
$font.Dispose()
$labelFont.Dispose()
$g.Dispose()
$bmp.Dispose()

$signature = @'
[DllImport("shell32.dll")]
public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
'@
try {
  $shell = Add-Type -MemberDefinition $signature -Name ShellRefresh -Namespace Win32 -PassThru
  $shell::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host ""
Write-Host "IZAKHONO WORK LOUD DESKTOP SHORTCUT = READY" -ForegroundColor Green
Write-Host ("Desktop: " + $desktop)
Write-Host ("Shortcut: " + $shortcut)
Write-Host ("Icon: " + $iconPath)
Write-Host ""
Write-Host "Press F5 on the desktop if Windows has not refreshed the icon yet."
