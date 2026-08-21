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
  # Windows PowerShell 5.1 may encode a string body with the system code page.
  # Send explicit UTF-8 bytes so Chinese batch labels survive the request.
  $utf8Body = [Text.Encoding]::UTF8.GetBytes($body)
  $result = Invoke-RestMethod -Uri ($SiteUrl.TrimEnd("/") + "/api/admin/activation-codes") -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" -Body $utf8Body
  $result.codes | Select-Object code, codeHint, label, expiresAt | Format-Table -AutoSize
} finally {
  if ($tokenPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr) }
  $plainToken = $null
}
