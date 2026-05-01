$files = Get-ChildItem -Path 'components/atelier/*.tsx'
foreach ($file in $files) {
    $content = Get-Content $file.FullName
    $newContent = @()
    $found = $false
    $skip = $false
    foreach ($line in $content) {
        if ($line -match 'const FIS: React\.CSSProperties = \{') {
            if (-not $found) {
                $newContent += $line
                $found = $true
            } else {
                $skip = $true
            }
        } elseif ($skip -and $line -match '^\}') {
            $skip = $false
        } elseif (-not $skip) {
            $newContent += $line
        }
    }
    Set-Content -Path $file.FullName -Value $newContent
}
