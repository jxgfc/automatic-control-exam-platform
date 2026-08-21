param(
  [string]$SiteUrl = "https://automatic-control-exam-platform.onrender.com",
  [int]$Count = 10,
  [int]$ExpiresInDays = 30,
  [string]$Label = ""
)

$token = Read-Host "ACTIVATION_ADMIN_TOKEN" -AsSecureString
$tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($token)
try {
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr)
  $headers = @{ Authorization = "Bearer $plainToken" }
  $body = @{ count = $Count; expiresInDays = $ExpiresInDays; label = $Label } | ConvertTo-Json
  $result = Invoke-RestMethod -Uri ($SiteUrl.TrimEnd("/") + "/api/admin/activation-codes") -Method Post -Headers $headers -ContentType "application/json" -Body $body
  $result.codes | Select-Object code, codeHint, label, expiresAt | Format-Table -AutoSize
} finally {
  if ($tokenPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr) }
  $plainToken = $null
}
