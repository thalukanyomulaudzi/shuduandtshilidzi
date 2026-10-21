<?php
declare(strict_types=1);

const MAX_BODY_BYTES = 12000;
const RSVP_RECIPIENT_EMAIL = 'rsvp@shuduandtshilidzi.co.za';
const DEFAULT_RSVP_DEADLINE = '2026-11-25';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function isValidDateOnly(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function escapeHtml(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function sendEmailThroughResend(array $payload, string $apiKey): bool
{
    $requestBody = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($requestBody === false) {
        error_log('Unable to encode an RSVP email request.');
        return false;
    }

    $curl = curl_init('https://api.resend.com/emails');
    if ($curl === false) {
        error_log('Unable to initialize an RSVP email request.');
        return false;
    }

    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $requestBody,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12
    ]);

    $providerResponse = curl_exec($curl);
    $curlError = curl_errno($curl);
    $providerStatus = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    curl_close($curl);

    if ($providerResponse === false) {
        error_log('RSVP email provider request failed with cURL error ' . $curlError . '.');
        return false;
    }

    $providerResult = json_decode($providerResponse, true);
    if ($providerStatus < 200 || $providerStatus >= 300 || !is_array($providerResult) || empty($providerResult['id'])) {
        error_log('RSVP email provider rejected a message. HTTP status: ' . $providerStatus . '.');
        return false;
    }

    return true;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Please send your reply using the RSVP form.']);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isJsonRequest = stripos($contentType, 'application/json') === 0;
$isFormRequest = stripos($contentType, 'application/x-www-form-urlencoded') === 0;
if (!$isJsonRequest && !$isFormRequest) {
    respond(415, ['error' => 'The reply form sent an unsupported request. Please refresh and try again.']);
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > MAX_BODY_BYTES) {
    respond(413, ['error' => 'Your reply is too long. Please shorten it and try again.']);
}

$input = fopen('php://input', 'rb');
if ($input === false) {
    respond(400, ['error' => 'We couldn’t read your reply. Please check the form and try again.']);
}
$rawBody = stream_get_contents($input, MAX_BODY_BYTES + 1);
fclose($input);

if ($rawBody === false || strlen($rawBody) > MAX_BODY_BYTES) {
    respond(413, ['error' => 'Your reply is too long. Please shorten it and try again.']);
}

$body = [];
if ($isJsonRequest) {
    $body = json_decode($rawBody, true);
    if (!is_array($body) || json_last_error() !== JSON_ERROR_NONE) {
        respond(400, ['error' => 'We couldn’t read your reply. Please check the form and try again.']);
    }
} else {
    parse_str($rawBody, $body);
}

if (isset($body['website']) && is_string($body['website']) && trim($body['website']) !== '') {
    respond(400, ['error' => 'We couldn’t send your reply. Please check the form and try again.']);
}

$name = isset($body['name']) && is_string($body['name']) ? trim($body['name']) : '';
$email = isset($body['email']) && is_string($body['email']) ? trim($body['email']) : '';
$attendance = $body['attendance'] ?? null;
$message = isset($body['message']) && is_string($body['message']) ? trim($body['message']) : '';

if ($name === '' || strlen($name) > 120 || preg_match('/[\x00-\x1F\x7F]/', $name)) {
    respond(400, ['error' => 'Please enter your name (up to 120 characters).']);
}
if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Please enter a valid email address.']);
}
if ($attendance !== 'attending' && $attendance !== 'declining') {
    respond(400, ['error' => 'Please choose whether you’ll be attending.']);
}
if (strlen($message) > 2000) {
    respond(400, ['error' => 'One of your replies is too long. Please shorten it and try again.']);
}

$deadline = getenv('RSVP_DEADLINE') ?: DEFAULT_RSVP_DEADLINE;
if (!isValidDateOnly($deadline)) {
    error_log('RSVP_DEADLINE must use YYYY-MM-DD.');
    respond(503, ['error' => 'Replies are temporarily unavailable. Please contact us.']);
}

$today = new DateTimeImmutable('now', new DateTimeZone('Africa/Johannesburg'));
if ($today->format('Y-m-d') > $deadline) {
    respond(410, ['error' => 'The RSVP deadline has passed. Please contact us.']);
}

$documentRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__), DIRECTORY_SEPARATOR);
$configPath = dirname($documentRoot) . DIRECTORY_SEPARATOR . 'shudu-rsvp-config.php';
$configuration = [];
if (is_file($configPath) && is_readable($configPath)) {
    try {
        $loadedConfiguration = require $configPath;
        if (is_array($loadedConfiguration)) {
            $configuration = $loadedConfiguration;
        }
    } catch (Throwable $error) {
        error_log('Unable to load the private RSVP configuration: ' . get_class($error));
        respond(503, ['error' => 'Replies are temporarily unavailable. Please contact us.']);
    }
}

$apiKey = getenv('RESEND_API_KEY') ?: ($configuration['resend_api_key'] ?? '');
$sender = getenv('WEDDING_FROM_EMAIL') ?: ($configuration['from_email'] ?? '');
if (!is_string($apiKey) || $apiKey === '' || !is_string($sender) || $sender === '') {
    error_log('RSVP email service is not configured.');
    respond(503, ['error' => 'Replies aren’t available just yet. Please try again later or contact us.']);
}

$senderAddress = $sender;
if (preg_match('/<([^<>]+)>/', $sender, $matches) === 1) {
    $senderAddress = $matches[1];
}
if (preg_match('/[\r\n]/', $sender) || !filter_var($senderAddress, FILTER_VALIDATE_EMAIL)) {
    error_log('WEDDING_FROM_EMAIL contains an invalid email address.');
    respond(503, ['error' => 'Replies aren’t available just yet. Please try again later or contact us.']);
}

if (!function_exists('curl_init')) {
    error_log('The PHP cURL extension is required for RSVP email delivery.');
    respond(503, ['error' => 'Replies are temporarily unavailable. Please contact us.']);
}

$isAttending = $attendance === 'attending';
$responseLabel = $isAttending ? 'Attending' : 'Not attending';
$safeName = escapeHtml($name);
$safeEmail = escapeHtml($email);
$safeMessage = escapeHtml($message);
$emailPayload = [
    'from' => $sender,
    'to' => [RSVP_RECIPIENT_EMAIL],
    'reply_to' => $email,
    'subject' => 'Wedding RSVP — ' . $name . ' — ' . $responseLabel,
    'text' => implode("\n", [
        'Wedding RSVP — Shudu & Tshilidzi',
        '',
        'Guest: ' . ($name !== '' ? $name : 'Not provided'),
        'Email: ' . ($email !== '' ? $email : 'Not provided'),
        'Attendance: ' . $responseLabel,
        'Message: ' . ($message !== '' ? $message : 'Not provided')
    ]),
    'html' => implode('', [
        '<h2>Wedding RSVP — Shudu &amp; Tshilidzi</h2>',
        '<dl>',
        '<dt><strong>Guest</strong></dt><dd>' . $safeName . '</dd>',
        '<dt><strong>Email</strong></dt><dd>' . $safeEmail . '</dd>',
        '<dt><strong>Attendance</strong></dt><dd>' . $responseLabel . '</dd>',
        '<dt><strong>Message</strong></dt><dd>' . ($safeMessage !== '' ? $safeMessage : 'Not provided') . '</dd>',
        '</dl>'
    ])
];

if (!sendEmailThroughResend($emailPayload, $apiKey)) {
    respond(502, ['error' => 'We couldn’t send your reply just now. Your details are still here — please try again.']);
}

$guestEmailPayload = [
    'from' => $sender,
    'to' => [$email],
    'reply_to' => RSVP_RECIPIENT_EMAIL,
    'subject' => 'We’ve received your wedding RSVP — Shudu & Tshilidzi',
    'text' => implode("\n", [
        'Dear ' . $name . ',',
        '',
        'Thank you for replying to our wedding invitation. We’ve received your RSVP.',
        '',
        'Your response: ' . $responseLabel,
        '',
        'Wedding details',
        'Date: 18 December 2026',
        'Time: 09:30 AM South African time',
        'Venue: The Marc Lifestyle Venue',
        '',
        'With love,',
        'Shudu & Tshilidzi'
    ]),
    'html' => implode('', [
        '<p>Dear ' . $safeName . ',</p>',
        '<p>Thank you for replying to our wedding invitation. We’ve received your RSVP.</p>',
        '<p><strong>Your response:</strong> ' . $responseLabel . '</p>',
        '<h2>Wedding details</h2>',
        '<p><strong>Date:</strong> 18 December 2026<br>',
        '<strong>Time:</strong> 09:30 AM South African time<br>',
        '<strong>Venue:</strong> The Marc Lifestyle Venue</p>',
        '<p>With love,<br>Shudu &amp; Tshilidzi</p>'
    ])
];

if (!sendEmailThroughResend($guestEmailPayload, $apiKey)) {
    error_log('The RSVP notification was accepted, but the guest confirmation email could not be sent.');
    respond(200, [
        'message' => 'Your RSVP has been received, but the confirmation email could not be sent.',
        'confirmationEmailSent' => false
    ]);
}

respond(200, [
    'message' => 'Your RSVP has been received and a confirmation email has been sent.',
    'confirmationEmailSent' => true
]);
