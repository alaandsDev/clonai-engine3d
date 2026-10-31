$ErrorActionPreference = 'Continue'
$checkNames = @('typecheck','check:engine3d','check:editorial','check:sound','check:visual','check:motion','check:demonstration','check:autodirector','check:semantics','check:narrative','check:writer','check:research','check:web-research','check:research-v2','check:research-v3','check:research-v4','check:topic-intelligence','check:vertical-slice','check:causal-curiosity','check:contextual-mechanism','check:visual-causal','engine3d:catalog','check:progressive-curiosity','check:contextual-parser')
$checkRoot = Join-Path (Get-Location) 'out/engine3d/phase28b/analysis/checks'
New-Item -ItemType Directory -Path $checkRoot -Force | Out-Null
$checkResults = @()
foreach ($checkName in $checkNames) {
    $checkLog = Join-Path $checkRoot ($checkName.Replace(':','-') + '.log')
    $checkTimer = [System.Diagnostics.Stopwatch]::StartNew()
    & npm run $checkName *> $checkLog
    $checkExit = $LASTEXITCODE
    $checkTimer.Stop()
    $checkText = Get-Content -LiteralPath $checkLog -Raw
    $testCount = if ($checkText -match '(?m)(?:ℹ |# )tests (\d+)') { [int]$Matches[1] } else { $null }
    $failCount = if ($checkText -match '(?m)(?:ℹ |# )fail (\d+)') { [int]$Matches[1] } else { $null }
    $checkResults += [pscustomobject]@{ command=$checkName; exit=$checkExit; tests=$testCount; failures=$failCount; ms=$checkTimer.ElapsedMilliseconds }
    $checkResults | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $checkRoot '../checks.json') -Encoding utf8
    Write-Output "$checkName exit=$checkExit tests=$testCount failures=$failCount"
}
if (@($checkResults | Where-Object { $_.exit -ne 0 }).Count -gt 0) { exit 1 }
