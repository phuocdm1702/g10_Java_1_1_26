package com.example.datn.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Dịch vụ hạ tầng chuyên trách lưu trữ & xóa file ảnh (Cloudinary Cloud Storage + tương thích ngược file local cũ).
 * Tách biệt hoàn toàn khỏi nghiệp vụ Entity/Database theo nguyên lý Single Responsibility (SRP).
 */
@Service
public class CloudinaryStorageService {
    public static final String LOCAL_URL_PREFIX = "/uploads/";

    private static final Pattern SECURE_URL_PATTERN = Pattern.compile("\"secure_url\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern ERROR_MSG_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern CLOUDINARY_PUBLIC_ID_PATTERN = Pattern.compile("/image/upload/(?:v\\d+/)?(.+)\\.[a-zA-Z0-9]+$");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    // Độ lệch thời gian giữa đồng hồ máy chạy Backend và giờ thực của server Cloudinary
    private volatile long clockOffsetSeconds = 0L;

    @Value("${app.upload-dir:uploads}")
    private String uploadDir;

    @Value("${app.cloudinary.url:}")
    private String cloudinaryUrl;

    @Value("${app.cloudinary.cloud-name:}")
    private String cloudName;

    @Value("${app.cloudinary.api-key:}")
    private String apiKey;

    @Value("${app.cloudinary.api-secret:}")
    private String apiSecret;

    @Value("${app.cloudinary.folder:polo-house}")
    private String folder;

    /**
     * Kiểm tra định dạng ảnh dựa trên Magic Bytes thực tế của file (chống giả mạo đuôi file hoặc Content-Type).
     */
    public String detectImageExtension(byte[] bytes) {
        if (bytes == null) return null;
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return ".jpg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 'P'
                && bytes[2] == 'N'
                && bytes[3] == 'G') {
            return ".png";
        }
        if (bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return ".webp";
        }
        return null;
    }

    /**
     * Tải mảng byte của ảnh lên Cloudinary và trả về đường dẫn HTTPS đầy đủ (secure_url).
     */
    public String uploadImage(byte[] bytes, String ext) {
        CloudinaryCredentials creds = resolveCredentials();
        if (creds == null) {
            throw new RuntimeException("Dịch vụ lưu trữ ảnh đám mây chưa được cấu hình");
        }

        String dataUri = "data:" + resolveMimeType(ext) + ";base64," + Base64.getEncoder().encodeToString(bytes);
        String publicId = UUID.randomUUID().toString();

        try {
            HttpResponse<String> res = sendUploadRequest(creds, dataUri, publicId, currentTimestamp());
            if ((res.statusCode() == 401 || res.statusCode() == 400) && syncClockOffsetFromResponse(res)) {
                res = sendUploadRequest(creds, dataUri, publicId, currentTimestamp());
            }

            if (res.statusCode() < 200 || res.statusCode() >= 300) {
                Matcher errMatcher = ERROR_MSG_PATTERN.matcher(res.body());
                String detail = errMatcher.find() ? errMatcher.group(1) : ("HTTP " + res.statusCode());
                throw new RuntimeException("Upload Cloudinary thất bại: " + detail);
            }

            Matcher m = SECURE_URL_PATTERN.matcher(res.body());
            if (!m.find()) {
                throw new RuntimeException("Không lấy được secure_url từ phản hồi Cloudinary");
            }
            return m.group(1).replace("\\/", "/");
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new RuntimeException("Không kết nối được tới Cloudinary để tải ảnh lên");
        }
    }

    /**
     * Xóa ảnh vật lý: tự động phân biệt ảnh trên Cloudinary và ảnh local (/uploads/...) cũ.
     */
    public void deleteImage(String url) {
        if (url == null || url.isBlank()) return;

        if (url.contains("res.cloudinary.com")) {
            deleteFromCloudinary(url);
            return;
        }

        if (url.startsWith(LOCAL_URL_PREFIX)) {
            deleteLocalFile(url);
        }
    }

    // ---------------------------------------------------------------
    // Các phương thức nội bộ (Private Helpers)
    // ---------------------------------------------------------------

    private void deleteFromCloudinary(String url) {
        CloudinaryCredentials creds = resolveCredentials();
        if (creds == null) return;

        Matcher m = CLOUDINARY_PUBLIC_ID_PATTERN.matcher(url);
        if (!m.find()) return;
        String publicId = m.group(1);

        try {
            HttpResponse<String> res = sendDestroyRequest(creds, publicId, currentTimestamp());
            if ((res.statusCode() == 401 || res.statusCode() == 400) && syncClockOffsetFromResponse(res)) {
                sendDestroyRequest(creds, publicId, currentTimestamp());
            }
        } catch (Exception ignored) {
            // Không chặn luồng xóa DB nếu kết nối mạng tới Cloudinary chập chờn
        }
    }

    private void deleteLocalFile(String url) {
        try {
            String fileName = Path.of(url.substring(LOCAL_URL_PREFIX.length())).getFileName().toString();
            Files.deleteIfExists(Path.of(uploadDir).toAbsolutePath().normalize().resolve(fileName));
        } catch (Exception ignored) {
        }
    }

    private HttpResponse<String> sendUploadRequest(CloudinaryCredentials creds, String dataUri, String publicId, String timestamp)
            throws IOException, InterruptedException {
        Map<String, String> signParams = new TreeMap<>();
        if (creds.folder() != null && !creds.folder().isBlank()) {
            signParams.put("folder", creds.folder().trim());
        }
        signParams.put("public_id", publicId);
        signParams.put("timestamp", timestamp);

        Map<String, String> formFields = new TreeMap<>(signParams);
        formFields.put("api_key", creds.apiKey());
        formFields.put("file", dataUri);
        formFields.put("signature", signParameters(signParams, creds.apiSecret()));

        return postForm("https://api.cloudinary.com/v1_1/" + creds.cloudName() + "/image/upload", formFields, 30);
    }

    private HttpResponse<String> sendDestroyRequest(CloudinaryCredentials creds, String publicId, String timestamp)
            throws IOException, InterruptedException {
        Map<String, String> signParams = new TreeMap<>();
        signParams.put("public_id", publicId);
        signParams.put("timestamp", timestamp);

        Map<String, String> formFields = new TreeMap<>(signParams);
        formFields.put("api_key", creds.apiKey());
        formFields.put("signature", signParameters(signParams, creds.apiSecret()));

        return postForm("https://api.cloudinary.com/v1_1/" + creds.cloudName() + "/image/destroy", formFields, 15);
    }

    private HttpResponse<String> postForm(String endpoint, Map<String, String> formFields, int timeoutSeconds)
            throws IOException, InterruptedException {
        String formBody = formFields.entrySet().stream()
                .map(e -> encodeForm(e.getKey()) + "=" + encodeForm(e.getValue()))
                .collect(Collectors.joining("&"));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .POST(HttpRequest.BodyPublishers.ofString(formBody, StandardCharsets.UTF_8))
                .build();

        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private String resolveMimeType(String ext) {
        return switch (ext) {
            case ".jpg" -> "image/jpeg";
            case ".png" -> "image/png";
            case ".webp" -> "image/webp";
            default -> "application/octet-stream";
        };
    }

    private String currentTimestamp() {
        return String.valueOf(Instant.now().getEpochSecond() + clockOffsetSeconds);
    }

    private boolean syncClockOffsetFromResponse(HttpResponse<?> res) {
        return res.headers().firstValue("date").map(dateStr -> {
            try {
                long serverEpoch = ZonedDateTime.parse(dateStr, DateTimeFormatter.RFC_1123_DATE_TIME).toEpochSecond();
                long localEpoch = Instant.now().getEpochSecond();
                this.clockOffsetSeconds = serverEpoch - localEpoch;
                return true;
            } catch (Exception e) {
                return false;
            }
        }).orElse(false);
    }

    private CloudinaryCredentials resolveCredentials() {
        Map<String, String> dotEnv = loadDotEnv();
        String cName = firstNonBlank(dotEnv.get("CLOUDINARY_CLOUD_NAME"), cloudName);
        String aKey = firstNonBlank(dotEnv.get("CLOUDINARY_API_KEY"), apiKey);
        String aSecret = firstNonBlank(dotEnv.get("CLOUDINARY_API_SECRET"), apiSecret);
        String cFolder = firstNonBlank(dotEnv.get("CLOUDINARY_FOLDER"), folder, "polo-house");
        String cUrl = firstNonBlank(dotEnv.get("CLOUDINARY_URL"), cloudinaryUrl);

        if (cName != null && aKey != null && aSecret != null) {
            return new CloudinaryCredentials(cName, aKey, aSecret, cFolder);
        }
        if (cUrl != null && cUrl.startsWith("cloudinary://")) {
            URI uri = URI.create(cUrl);
            String userInfo = uri.getUserInfo();
            String host = uri.getHost();
            if (userInfo != null && userInfo.contains(":") && host != null && !host.isBlank()) {
                int idx = userInfo.indexOf(':');
                return new CloudinaryCredentials(host, userInfo.substring(0, idx), userInfo.substring(idx + 1), cFolder);
            }
        }
        return null;
    }

    private Map<String, String> loadDotEnv() {
        Map<String, String> map = new HashMap<>();
        List<Path> candidates = List.of(Path.of(".env"), Path.of("DATN/.env"), Path.of("../.env"));
        for (Path p : candidates) {
            try {
                if (Files.isRegularFile(p)) {
                    for (String line : Files.readAllLines(p, StandardCharsets.UTF_8)) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                        int eq = trimmed.indexOf('=');
                        if (eq > 0) {
                            String k = trimmed.substring(0, eq).trim();
                            String v = stripQuotes(trimmed.substring(eq + 1).trim());
                            if (!v.isEmpty()) map.putIfAbsent(k, v);
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return map;
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null) {
                String cleaned = stripQuotes(v.trim());
                if (!cleaned.isEmpty()) return cleaned;
            }
        }
        return null;
    }

    private String stripQuotes(String s) {
        if (s.length() >= 2 && ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'")))) {
            return s.substring(1, s.length() - 1).trim();
        }
        return s;
    }

    private String signParameters(Map<String, String> params, String secret) {
        String toSign = params.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&")) + secret;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            return HexFormat.of().formatHex(md.digest(toSign.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException("Không tạo được chữ ký bảo mật Cloudinary");
        }
    }

    private String encodeForm(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record CloudinaryCredentials(String cloudName, String apiKey, String apiSecret, String folder) {}
}
