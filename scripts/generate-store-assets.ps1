param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $ProjectRoot "public\icons"
$storeDir = Join-Path $ProjectRoot "store-assets\chrome-web-store"

New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
New-Item -ItemType Directory -Force -Path $storeDir | Out-Null

function New-Brush {
  param([System.Drawing.Color]$Color)
  return [System.Drawing.SolidBrush]::new($Color)
}

function New-Pen {
  param(
    [System.Drawing.Color]$Color,
    [float]$Width
  )
  return [System.Drawing.Pen]::new($Color, [single]$Width)
}

function New-Font {
  param(
    [string]$Name,
    [float]$Size,
    [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular
  )
  return [System.Drawing.Font]::new($Name, [single]$Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-PointF {
  param(
    [float]$X,
    [float]$Y
  )
  return [System.Drawing.PointF]::new([single]$X, [single]$Y)
}

function New-RectF {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height
  )
  return [System.Drawing.RectangleF]::new([single]$X, [single]$Y, [single]$Width, [single]$Height)
}

function New-LinearBrush {
  param(
    [float]$X1,
    [float]$Y1,
    [float]$X2,
    [float]$Y2,
    [System.Drawing.Color]$Color1,
    [System.Drawing.Color]$Color2
  )

  $point1 = New-PointF -X $X1 -Y $Y1
  $point2 = New-PointF -X $X2 -Y $Y2
  return [System.Drawing.Drawing2D.LinearGradientBrush]::new($point1, $point2, $Color1, $Color2)
}

function New-RoundedPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Width, $Height))

  if ($diameter -le 0) {
    $path.AddRectangle((New-RectF -X $X -Y $Y -Width $Width -Height $Height))
    return $path
  }

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Set-CanvasQuality {
  param([System.Drawing.Graphics]$Graphics)

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

function Draw-BrandGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $platePen = New-Pen -Color ([System.Drawing.Color]::FromArgb(242, 246, 252)) -Width ($Size * 0.08)
  $platePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $bulbPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(255, 197, 103)) -Width ($Size * 0.07)
  $bulbPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $bulbPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bulbPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $dotBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(102, 226, 190))

  try {
    $plateX = $X + ($Size * 0.16)
    $plateY = $Y + ($Size * 0.18)
    $plateW = $Size * 0.68
    $plateH = $Size * 0.74
    $platePath = New-RoundedPath -X $plateX -Y $plateY -Width $plateW -Height $plateH -Radius ($Size * 0.14)

    try {
      $Graphics.DrawPath($platePen, $platePath)
    } finally {
      $platePath.Dispose()
    }

    $Graphics.DrawLine(
      $platePen,
      $plateX + ($plateW / 2),
      $plateY + ($Size * 0.16),
      $plateX + ($plateW / 2),
      $plateY + $plateH - ($Size * 0.18)
    )

    $dotRadius = $Size * 0.04
    $Graphics.FillEllipse($dotBrush, $plateX + ($plateW * 0.22), $plateY + ($plateH * 0.78), $dotRadius * 2, $dotRadius * 2)
    $Graphics.FillEllipse($dotBrush, $plateX + ($plateW * 0.66), $plateY + ($plateH * 0.78), $dotRadius * 2, $dotRadius * 2)

    $bulbRect = New-RectF -X ($X + ($Size * 0.37)) -Y ($Y + ($Size * 0.03)) -Width ($Size * 0.26) -Height ($Size * 0.26)
    $Graphics.DrawEllipse($bulbPen, $bulbRect)
    $Graphics.DrawLine($bulbPen, $X + ($Size * 0.5), $Y + ($Size * 0.29), $X + ($Size * 0.5), $Y + ($Size * 0.38))
    $Graphics.DrawLine($bulbPen, $X + ($Size * 0.44), $Y + ($Size * 0.38), $X + ($Size * 0.56), $Y + ($Size * 0.38))
    $Graphics.DrawLine($bulbPen, $X + ($Size * 0.45), $Y + ($Size * 0.43), $X + ($Size * 0.55), $Y + ($Size * 0.43))
  } finally {
    $platePen.Dispose()
    $bulbPen.Dispose()
    $dotBrush.Dispose()
  }
}

function Draw-Icon {
  param(
    [int]$Size,
    [string]$Path
  )

  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Set-CanvasQuality $graphics

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $backgroundPath = New-RoundedPath -X 0 -Y 0 -Width $Size -Height $Size -Radius ($Size * 0.24)
    $backgroundBrush = New-LinearBrush -X1 0 -Y1 0 -X2 $Size -Y2 $Size -Color1 ([System.Drawing.Color]::FromArgb(20, 27, 43)) -Color2 ([System.Drawing.Color]::FromArgb(8, 12, 19))
    $accentBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(52, 115, 168, 255))
    $warmBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(58, 255, 197, 103))
    $borderPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(44, 255, 255, 255)) -Width ([Math]::Max(1, $Size * 0.03))

    try {
      $graphics.FillPath($backgroundBrush, $backgroundPath)
      $graphics.FillEllipse($accentBrush, -($Size * 0.08), -($Size * 0.02), $Size * 0.62, $Size * 0.62)
      $graphics.FillEllipse($warmBrush, $Size * 0.54, $Size * 0.48, $Size * 0.4, $Size * 0.4)
      $graphics.DrawPath($borderPen, $backgroundPath)
    } finally {
      $backgroundPath.Dispose()
      $backgroundBrush.Dispose()
      $accentBrush.Dispose()
      $warmBrush.Dispose()
      $borderPen.Dispose()
    }

    Draw-BrandGlyph -Graphics $graphics -X 0 -Y 0 -Size $Size
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Draw-Card {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [string]$Title,
    [string[]]$Channels,
    [bool]$Online
  )

  $cardPath = New-RoundedPath -X $X -Y $Y -Width $Width -Height $Height -Radius 26
  $cardBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(255, 16, 22, 34))
  $borderPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(30, 255, 255, 255)) -Width 2
  $textBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(237, 242, 251))
  $mutedBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(126, 145, 172))
  $pillBrush = New-Brush -Color (
    $(if ($Online) { [System.Drawing.Color]::FromArgb(32, 102, 226, 190) } else { [System.Drawing.Color]::FromArgb(32, 255, 134, 122) })
  )
  $pillTextBrush = New-Brush -Color (
    $(if ($Online) { [System.Drawing.Color]::FromArgb(102, 226, 190) } else { [System.Drawing.Color]::FromArgb(255, 134, 122) })
  )
  $titleFont = New-Font -Name "Segoe UI Semibold" -Size 18
  $metaFont = New-Font -Name "Segoe UI" -Size 12
  $tileFont = New-Font -Name "Segoe UI Semibold" -Size 12

  try {
    $Graphics.FillPath($cardBrush, $cardPath)
    $Graphics.DrawPath($borderPen, $cardPath)
    $Graphics.DrawString($Title, $titleFont, $textBrush, $X + 22, $Y + 18)

    $pillPath = New-RoundedPath -X ($X + $Width - 92) -Y ($Y + 18) -Width 70 -Height 28 -Radius 14
    try {
      $Graphics.FillPath($pillBrush, $pillPath)
    } finally {
      $pillPath.Dispose()
    }
    $Graphics.DrawString($(if ($Online) { "Online" } else { "Offline" }), $metaFont, $pillTextBrush, $X + $Width - 78, $Y + 24)

    $tileWidth = ($Width - 54) / 2
    $tileHeight = 62
    for ($i = 0; $i -lt [Math]::Min($Channels.Count, 4); $i++) {
      $tileX = $X + 18 + (($i % 2) * ($tileWidth + 12))
      $tileY = $Y + 62 + ([Math]::Floor($i / 2) * ($tileHeight + 10))
      $tilePath = New-RoundedPath -X $tileX -Y $tileY -Width $tileWidth -Height $tileHeight -Radius 18
      $tileBrush = New-Brush -Color (
        $(if (($i % 3) -eq 0) { [System.Drawing.Color]::FromArgb(255, 45, 40, 28) } else { [System.Drawing.Color]::FromArgb(255, 24, 31, 45) })
      )
      $tilePen = New-Pen -Color (
        $(if (($i % 3) -eq 0) { [System.Drawing.Color]::FromArgb(70, 255, 197, 103) } else { [System.Drawing.Color]::FromArgb(36, 255, 255, 255) })
      ) -Width 1.5
      try {
        $Graphics.FillPath($tileBrush, $tilePath)
        $Graphics.DrawPath($tilePen, $tilePath)
      } finally {
        $tilePath.Dispose()
        $tileBrush.Dispose()
        $tilePen.Dispose()
      }
      $Graphics.DrawString($Channels[$i], $tileFont, $textBrush, $tileX + 14, $tileY + 15)
      $Graphics.DrawString($(if (($i % 3) -eq 0) { "ON" } else { "OFF" }), $metaFont, $mutedBrush, $tileX + 14, $tileY + 36)
    }
  } finally {
    $cardPath.Dispose()
    $cardBrush.Dispose()
    $borderPen.Dispose()
    $textBrush.Dispose()
    $mutedBrush.Dispose()
    $pillBrush.Dispose()
    $pillTextBrush.Dispose()
    $titleFont.Dispose()
    $metaFont.Dispose()
    $tileFont.Dispose()
  }
}

function Draw-Shell {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [scriptblock]$Content
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Set-CanvasQuality $graphics

  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(9, 13, 21))
    $background = New-LinearBrush -X1 0 -Y1 0 -X2 $Width -Y2 $Height -Color1 ([System.Drawing.Color]::FromArgb(17, 24, 38)) -Color2 ([System.Drawing.Color]::FromArgb(7, 10, 16))
    $graphics.FillRectangle($background, 0, 0, $Width, $Height)
    $background.Dispose()

    $glowBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(34, 115, 168, 255))
    $warmBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(28, 255, 197, 103))
    $graphics.FillEllipse($glowBrush, -80, -40, 340, 340)
    $graphics.FillEllipse($warmBrush, $Width - 260, $Height - 240, 320, 320)
    $glowBrush.Dispose()
    $warmBrush.Dispose()

    & $Content $graphics
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Draw-UserScreenshot {
  param([string]$Path)

  Draw-Shell -Width 1280 -Height 800 -Path $Path -Content {
    param($Graphics)

    $panelPath = New-RoundedPath -X 80 -Y 72 -Width 1120 -Height 656 -Radius 42
    $panelBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(236, 12, 18, 29))
    $panelPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(28, 255, 255, 255)) -Width 2
    $titleBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(237, 242, 251))
    $subBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(141, 159, 184))
    $titleFont = New-Font -Name "Segoe UI Semibold" -Size 34
    $subFont = New-Font -Name "Segoe UI" -Size 18

    try {
      $Graphics.FillPath($panelBrush, $panelPath)
      $Graphics.DrawPath($panelPen, $panelPath)
      $Graphics.DrawString("Tuya Desk", $titleFont, $titleBrush, 132, 106)
      $Graphics.DrawString("Compact user mode with per-channel control and fast cloud sync.", $subFont, $subBrush, 134, 152)

      $searchPath = New-RoundedPath -X 132 -Y 196 -Width 368 -Height 50 -Radius 18
      $searchBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(255, 25, 32, 46))
      $searchPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(26, 255, 255, 255)) -Width 2
      try {
        $Graphics.FillPath($searchBrush, $searchPath)
        $Graphics.DrawPath($searchPen, $searchPath)
      } finally {
        $searchPath.Dispose()
        $searchBrush.Dispose()
        $searchPen.Dispose()
      }

      $Graphics.DrawString("Search devices", $subFont, $subBrush, 156, 210)
      $Graphics.DrawString("All", $subFont, $titleBrush, 538, 210)
      $Graphics.DrawString("Online", $subFont, $subBrush, 608, 210)
      $Graphics.DrawString("Offline", $subFont, $subBrush, 708, 210)

      Draw-Card -Graphics $Graphics -X 132 -Y 276 -Width 470 -Height 188 -Title "Sala" -Channels @("Switch 1", "Switch 2", "Switch 3") -Online $true
      Draw-Card -Graphics $Graphics -X 618 -Y 276 -Width 470 -Height 188 -Title "Entrada" -Channels @("Switch 1", "Switch 2", "Light") -Online $true
      Draw-Card -Graphics $Graphics -X 132 -Y 484 -Width 470 -Height 188 -Title "Bano" -Channels @("Switch 1", "Switch 2") -Online $true
      Draw-Card -Graphics $Graphics -X 618 -Y 484 -Width 470 -Height 188 -Title "Pasillo" -Channels @("Switch 1", "Switch 2", "Switch 3", "Switch 4") -Online $false
    } finally {
      $panelPath.Dispose()
      $panelBrush.Dispose()
      $panelPen.Dispose()
      $titleBrush.Dispose()
      $subBrush.Dispose()
      $titleFont.Dispose()
      $subFont.Dispose()
    }
  }
}

function Draw-DeveloperScreenshot {
  param([string]$Path)

  Draw-Shell -Width 1280 -Height 800 -Path $Path -Content {
    param($Graphics)

    $panelPath = New-RoundedPath -X 80 -Y 72 -Width 1120 -Height 656 -Radius 42
    $panelBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(236, 12, 18, 29))
    $panelPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(28, 255, 255, 255)) -Width 2
    $titleBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(237, 242, 251))
    $subBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(141, 159, 184))
    $titleFont = New-Font -Name "Segoe UI Semibold" -Size 34
    $subFont = New-Font -Name "Segoe UI" -Size 18
    $monoFont = New-Font -Name "Segoe UI" -Size 16

    try {
      $Graphics.FillPath($panelBrush, $panelPath)
      $Graphics.DrawPath($panelPen, $panelPath)
      $Graphics.DrawString("Developer mode and ordering", $titleFont, $titleBrush, 132, 106)
      $Graphics.DrawString("Inspect ids, edit aliases and save the display order across Chrome sync.", $subFont, $subBrush, 134, 152)

      $leftPanel = New-RoundedPath -X 132 -Y 214 -Width 460 -Height 434 -Radius 28
      $rightPanel = New-RoundedPath -X 620 -Y 214 -Width 468 -Height 434 -Radius 28
      $sectionBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(255, 18, 25, 38))
      $sectionPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(26, 255, 255, 255)) -Width 2
      try {
        $Graphics.FillPath($sectionBrush, $leftPanel)
        $Graphics.FillPath($sectionBrush, $rightPanel)
        $Graphics.DrawPath($sectionPen, $leftPanel)
        $Graphics.DrawPath($sectionPen, $rightPanel)
      } finally {
        $leftPanel.Dispose()
        $rightPanel.Dispose()
        $sectionBrush.Dispose()
        $sectionPen.Dispose()
      }

      $Graphics.DrawString("Configuration", $subFont, $titleBrush, 160, 244)
      $Graphics.DrawString("Client ID", $monoFont, $subBrush, 160, 292)
      $Graphics.DrawString("Base URL", $monoFont, $subBrush, 160, 382)
      $Graphics.DrawString("Region", $monoFont, $subBrush, 160, 472)
      $Graphics.DrawString("Western America Data Center", $monoFont, $titleBrush, 160, 504)

      $Graphics.DrawString("Device order", $subFont, $titleBrush, 648, 244)
      $items = @("Sala", "Entrada", "Bano", "Pasillo")
      for ($i = 0; $i -lt $items.Count; $i++) {
        $y = 286 + ($i * 82)
        $itemPath = New-RoundedPath -X 648 -Y $y -Width 412 -Height 60 -Radius 18
        $itemBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(255, 24, 31, 45))
        $itemPen = New-Pen -Color ([System.Drawing.Color]::FromArgb(28, 255, 255, 255)) -Width 1.5
        try {
          $Graphics.FillPath($itemBrush, $itemPath)
          $Graphics.DrawPath($itemPen, $itemPath)
        } finally {
          $itemPath.Dispose()
          $itemBrush.Dispose()
          $itemPen.Dispose()
        }
        $Graphics.DrawString($items[$i], $subFont, $titleBrush, 672, $y + 16)
        $Graphics.DrawString("$($i + 1) / 4", $monoFont, $subBrush, 976, $y + 18)
      }
    } finally {
      $panelPath.Dispose()
      $panelBrush.Dispose()
      $panelPen.Dispose()
      $titleBrush.Dispose()
      $subBrush.Dispose()
      $titleFont.Dispose()
      $subFont.Dispose()
      $monoFont.Dispose()
    }
  }
}

function Draw-PromoTile {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [string]$Headline,
    [string]$Subline
  )

  Draw-Shell -Width $Width -Height $Height -Path $Path -Content {
    param($Graphics)

    $headlineBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(237, 242, 251))
    $subBrush = New-Brush -Color ([System.Drawing.Color]::FromArgb(156, 170, 190))
    $headlineFont = New-Font -Name "Segoe UI Semibold" -Size ($Height * 0.13)
    $subFont = New-Font -Name "Segoe UI" -Size ($Height * 0.07)

    try {
      Draw-BrandGlyph -Graphics $Graphics -X ($Width * 0.08) -Y ($Height * 0.18) -Size ($Height * 0.52)
      $Graphics.DrawString($Headline, $headlineFont, $headlineBrush, $Width * 0.36, $Height * 0.22)
      $Graphics.DrawString($Subline, $subFont, $subBrush, $Width * 0.36, $Height * 0.48)
    } finally {
      $headlineBrush.Dispose()
      $subBrush.Dispose()
      $headlineFont.Dispose()
      $subFont.Dispose()
    }
  }
}

Draw-Icon -Size 16 -Path (Join-Path $iconDir "icon-16.png")
Draw-Icon -Size 32 -Path (Join-Path $iconDir "icon-32.png")
Draw-Icon -Size 48 -Path (Join-Path $iconDir "icon-48.png")
Draw-Icon -Size 128 -Path (Join-Path $iconDir "icon-128.png")

Copy-Item (Join-Path $iconDir "icon-128.png") (Join-Path $storeDir "icon-128.png") -Force
Draw-UserScreenshot -Path (Join-Path $storeDir "screenshot-1-user.png")
Draw-DeveloperScreenshot -Path (Join-Path $storeDir "screenshot-2-developer.png")
Draw-PromoTile -Width 440 -Height 280 -Path (Join-Path $storeDir "small-promo-tile.png") -Headline "Tuya Desk" -Subline "Control your Tuya light switches from Chrome."
Draw-PromoTile -Width 920 -Height 680 -Path (Join-Path $storeDir "large-promo-tile.png") -Headline "Tuya Desk" -Subline "Fast channel controls, synced setup and developer details."

Write-Host "Generated icons and Chrome Web Store assets."
