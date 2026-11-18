package com.example.datn.service;

import com.example.datn.dto.AnhResponse;
import com.example.datn.entity.Anh;
import com.example.datn.entity.MauSac;
import com.example.datn.entity.SanPham;
import com.example.datn.entity.SanPhamChiTiet;
import com.example.datn.repository.AnhRepository;
import com.example.datn.repository.MauSacRepository;
import com.example.datn.repository.SanPhamChiTietRepository;
import com.example.datn.repository.SanPhamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnhService {
    private static final int MAX_PER_GROUP = 8;
    private static final String URL_PREFIX = "/uploads/";
    private static final String DEFAULT_PLACEHOLDER = "/images/products/default-placeholder.png";
    private static final Pattern SECURE_URL_PATTERN = Pattern.compile("\"secure_url\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern ERROR_MSG_PATTERN = Pattern.compile("\"message\"\\s*:\\s*\"([^\"]+)\"");
    private static final Pattern CLOUDINARY_PUBLIC_ID_PATTERN = Pattern.compile("/image/upload/(?:v\\d+/)?(.+)\\.[a-zA-Z0-9]+$");

    private final AnhRepository anhRepo;
    private final SanPhamRepository spRepo;
    private final MauSacRepository mauRepo;
    private final SanPhamChiTietRepository spctRepo;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    // Độ lệch thời gian giữa đồng hồ máy tính (ví dụ đang đặt năm 2026) và giờ thực của server Cloudinary
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

    @Transactional(readOnly = true)
    public List<AnhResponse> list(Integer idAo) {
        return anhRepo.findByProduct(idAo).stream()
                .filter(a -> !isDummyPlaceholder(a.getAnhUrl()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AnhResponse upload(Integer idAo, Integer idMau, MultipartFile file) {
        if (file == null || file.isEmpty()) throw new RuntimeException("Chưa chọn file ảnh");
        SanPham sp = spRepo.findById(idAo).orElseThrow(() -> new RuntimeException("Không tìm thấy sản phẩm"));
        MauSac mau = idMau == null ? null
                : mauRepo.findById(idMau).orElseThrow(() -> new RuntimeException("Màu không tồn tại"));

        // Dọn dẹp các dòng ảnh placeholder giả (/images/products/...) của sản phẩm này trong SQL seed nếu còn
        List<Anh> dummies = anhRepo.findByProduct(idAo).stream()
                .filter(a -> isDummyPlaceholder(a.getAnhUrl()))
                .toList();
        if (!dummies.isEmpty()) {
            anhRepo.deleteAll(dummies);
            anhRepo.flush();
        }

        List<Anh> group = sameGroup(idAo, idMau);
        if (group.size() >= MAX_PER_GROUP)
            throw new RuntimeException("Mỗi màu tối đa " + MAX_PER_GROUP + " ảnh");

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Không đọc được file ảnh");
        }
        // Kiểm tra theo nội dung file, không tin vào phần đuôi hay Content-Type do client gửi
        String ext = detectExt(bytes);
        if (ext == null) throw new RuntimeException("Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP");

        String storedUrl = uploadToCloudinary(bytes, ext);

        Anh a = new Anh();
        a.setSanPham(sp);
        a.setMauSac(mau);
        a.setAnhUrl(storedUrl);
        a.setMoTa("");
        a.setThuTu(group.stream().mapToInt(x -> x.getThuTu() == null ? 0 : x.getThuTu()).max().orElse(-1) + 1);
        a.setTrangThai(true);
        Anh saved = anhRepo.saveAndFlush(a);

        syncVariantImages(idAo);
        return toResponse(saved);
    }

    // Đưa ảnh được chọn lên đầu nhóm (thành ảnh chính)
    @Transactional
    public void setPrimary(Integer id) {
        Anh chosen = anhRepo.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy ảnh"));
        Integer idAo = chosen.getSanPham().getId();
        List<Anh> group = sameGroup(idAo,
                chosen.getMauSac() == null ? null : chosen.getMauSac().getId());

        List<Anh> ordered = new ArrayList<>();
        group.stream().filter(a -> a.getId().equals(id)).findFirst().ifPresent(ordered::add);
        group.stream().filter(a -> !a.getId().equals(id)).forEach(ordered::add);
        for (int i = 0; i < ordered.size(); i++) ordered.get(i).setThuTu(i);
        anhRepo.saveAllAndFlush(ordered);

        syncVariantImages(idAo);
    }

    @Transactional
    public void delete(Integer id) {
        Anh a = anhRepo.findById(id).orElseThrow(() -> new RuntimeException("Không tìm thấy ảnh"));
        Integer idAo = a.getSanPham().getId();
        String url = a.getAnhUrl();
        anhRepo.delete(a);
        anhRepo.flush();

        deleteFile(url);
        syncVariantImages(idAo);
    }

    // ---------------------------------------------------------------

    // Đồng bộ SanPhamChiTiet.anh_url bằng ảnh chính của màu tương ứng (hoặc ảnh chung) để hóa đơn admin không trống ảnh
    private void syncVariantImages(Integer idAo) {
        List<Anh> productImages = anhRepo.findByProduct(idAo).stream()
                .filter(img -> !isDummyPlaceholder(img.getAnhUrl()))
                .toList();
        List<SanPhamChiTiet> variants = spctRepo.findAllByProductId(idAo);
        if (variants.isEmpty()) return;

        String commonPrimary = productImages.stream()
                .filter(img -> img.getMauSac() == null)
                .map(Anh::getAnhUrl)
                .findFirst()
                .orElse(DEFAULT_PLACEHOLDER);

        for (SanPhamChiTiet v : variants) {
            Integer mauId = v.getMauSac() == null ? null : v.getMauSac().getId();
            String primaryForColor = productImages.stream()
                    .filter(img -> img.getMauSac() != null && Objects.equals(img.getMauSac().getId(), mauId))
                    .map(Anh::getAnhUrl)
                    .findFirst()
                    .orElse(commonPrimary);
            v.setAnhUrl(primaryForColor);
        }
        spctRepo.saveAll(variants);
    }

    private boolean isDummyPlaceholder(String url) {
        return url == null || url.isBlank() || url.startsWith("/images/products/");
    }

    private String uploadToCloudinary(byte[] bytes, String ext) {
        CloudinaryCredentials creds = resolveCredentials();
        if (creds == null) {
            throw new RuntimeException("Chưa cấu hình Cloudinary trong file DATN/.env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)");
        }

        String mimeType = switch (ext) {
            case ".jpg" -> "image/jpeg";
            case ".png" -> "image/png";
            case ".webp" -> "image/webp";
            default -> "application/octet-stream";
        };
        String dataUri = "data:" + mimeType + ";base64," + Base64.getEncoder().encodeToString(bytes);
        String publicId = UUID.randomUUID().toString();

        try {
            HttpResponse<String> res = sendCloudinaryUpload(creds, dataUri, publicId, currentTimestamp());
            // Nếu máy tính đang chỉnh lệch ngày/giờ (ví dụ năm 2026) khiến Cloudinary báo 401/400 Stale request -> tự đồng bộ giờ theo header Date của Cloudinary và gửi lại ngay
            if ((res.statusCode() == 401 || res.statusCode() == 400) && updateClockOffsetFromResponse(res)) {
                res = sendCloudinaryUpload(creds, dataUri, publicId, currentTimestamp());
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

    private HttpResponse<String> sendCloudinaryUpload(CloudinaryCredentials creds, String dataUri, String publicId, String timestamp)
            throws IOException, InterruptedException {
        Map<String, String> signParams = new TreeMap<>();
        if (creds.folder() != null && !creds.folder().isBlank()) {
            signParams.put("folder", creds.folder().trim());
        }
        signParams.put("public_id", publicId);
        signParams.put("timestamp", timestamp);

        String signature = sign(signParams, creds.apiSecret());

        Map<String, String> formFields = new TreeMap<>(signParams);
        formFields.put("api_key", creds.apiKey());
        formFields.put("file", dataUri);
        formFields.put("signature", signature);

        String formBody = formFields.entrySet().stream()
                .map(e -> encodeForm(e.getKey()) + "=" + encodeForm(e.getValue()))
                .collect(Collectors.joining("&"));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.cloudinary.com/v1_1/" + creds.cloudName() + "/image/upload"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(formBody, StandardCharsets.UTF_8))
                .build();

        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private void deleteFile(String url) {
        if (url == null || url.isBlank()) return;

        // 1. Nếu là ảnh trên Cloudinary -> xóa trên Cloud
        if (url.contains("res.cloudinary.com")) {
            deleteFromCloudinary(url);
            return;
        }

        // 2. Tương thích ngược: nếu là ảnh local cũ (/uploads/...) -> xóa trong thư mục local
        if (url.startsWith(URL_PREFIX)) {
            try {
                String fileName = Path.of(url.substring(URL_PREFIX.length())).getFileName().toString();
                Files.deleteIfExists(Path.of(uploadDir).toAbsolutePath().normalize().resolve(fileName));
            } catch (Exception ignored) {
            }
        }
    }

    private void deleteFromCloudinary(String url) {
        CloudinaryCredentials creds = resolveCredentials();
        if (creds == null) return;

        Matcher m = CLOUDINARY_PUBLIC_ID_PATTERN.matcher(url);
        if (!m.find()) return;
        String publicId = m.group(1);

        try {
            HttpResponse<String> res = sendCloudinaryDestroy(creds, publicId, currentTimestamp());
            if ((res.statusCode() == 401 || res.statusCode() == 400) && updateClockOffsetFromResponse(res)) {
                sendCloudinaryDestroy(creds, publicId, currentTimestamp());
            }
        } catch (Exception ignored) {
            // Nếu mạng lỗi khi xóa trên cloud thì bỏ qua để không rollback giao dịch xóa trong DB
        }
    }

    private HttpResponse<String> sendCloudinaryDestroy(CloudinaryCredentials creds, String publicId, String timestamp)
            throws IOException, InterruptedException {
        Map<String, String> signParams = new TreeMap<>();
        signParams.put("public_id", publicId);
        signParams.put("timestamp", timestamp);

        String signature = sign(signParams, creds.apiSecret());

        Map<String, String> formFields = new TreeMap<>(signParams);
        formFields.put("api_key", creds.apiKey());
        formFields.put("signature", signature);

        String formBody = formFields.entrySet().stream()
                .map(e -> encodeForm(e.getKey()) + "=" + encodeForm(e.getValue()))
                .collect(Collectors.joining("&"));

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.cloudinary.com/v1_1/" + creds.cloudName() + "/image/destroy"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(formBody, StandardCharsets.UTF_8))
                .build();

        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private String currentTimestamp() {
        return String.valueOf(Instant.now().getEpochSecond() + clockOffsetSeconds);
    }

    private boolean updateClockOffsetFromResponse(HttpResponse<?> res) {
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

    // Tự động đọc trực tiếp từ file .env trên đĩa (nếu có) để sửa .env là nhận ngay không cần restart Backend
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
        List<Path> candidates = List.of(
                Path.of(".env"),
                Path.of("DATN/.env"),
                Path.of("../.env")
        );
        for (Path p : candidates) {
            try {
                if (Files.isRegularFile(p)) {
                    for (String line : Files.readAllLines(p, StandardCharsets.UTF_8)) {
                        String trimmed = line.trim();
                        if (trimmed.isEmpty() || trimmed.startsWith("#")) continue;
                        int eq = trimmed.indexOf('=');
                        if (eq > 0) {
                            String k = trimmed.substring(0, eq).trim();
                            String v = cleanQuotes(trimmed.substring(eq + 1).trim());
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
                String cleaned = cleanQuotes(v.trim());
                if (!cleaned.isEmpty()) return cleaned;
            }
        }
        return null;
    }

    private String cleanQuotes(String s) {
        if (s.length() >= 2 && ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'")))) {
            return s.substring(1, s.length() - 1).trim();
        }
        return s;
    }

    private String sign(Map<String, String> params, String secret) {
        String toSign = params.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("&")) + secret;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] digest = md.digest(toSign.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException("Không tạo được chữ ký bảo mật Cloudinary");
        }
    }

    private String encodeForm(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record CloudinaryCredentials(String cloudName, String apiKey, String apiSecret, String folder) {}

    private List<Anh> sameGroup(Integer idAo, Integer idMau) {
        return anhRepo.findByProduct(idAo).stream()
                .filter(a -> Objects.equals(a.getMauSac() == null ? null : a.getMauSac().getId(), idMau))
                .toList();
    }

    private AnhResponse toResponse(Anh a) {
        return new AnhResponse(a.getId(),
                a.getMauSac() == null ? null : a.getMauSac().getId(),
                a.getAnhUrl(), a.getThuTu());
    }

    private String detectExt(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return ".jpg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return ".png";
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return ".webp";
        return null;
    }
}
