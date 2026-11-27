package com.example.datn.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.TreeMap;

// Tạo link thanh toán VNPay và kiểm tra chữ ký VNPay gửi về.
// Mã tham chiếu giao dịch (vnp_TxnRef) chính là mã hóa đơn, nên không cần lưu thêm gì trong bộ nhớ.
@Service
public class VnpayService {
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Value("${app.vnpay.tmn-code:}")
    private String tmnCode;
    @Value("${app.vnpay.hash-secret:}")
    private String hashSecret;
    @Value("${app.vnpay.pay-url}")
    private String payUrl;
    @Value("${app.vnpay.return-url}")
    private String returnUrl;
    @Value("${app.vnpay.expire-minutes:15}")
    private int expireMinutes;

    public String taoUrlThanhToan(String maHoaDon, BigDecimal tong, String ip) {
        LocalDateTime now = LocalDateTime.now(VN);

        Map<String, String> p = new TreeMap<>();
        p.put("vnp_Version", "2.1.0");
        p.put("vnp_Command", "pay");
        p.put("vnp_TmnCode", tmnCode);
        p.put("vnp_Amount", String.valueOf(tong.setScale(0, RoundingMode.HALF_UP).longValueExact() * 100));
        p.put("vnp_CurrCode", "VND");
        p.put("vnp_TxnRef", maHoaDon);
        p.put("vnp_OrderInfo", "ThanhToanDonHang" + maHoaDon);
        p.put("vnp_OrderType", "other");
        p.put("vnp_Locale", "vn");
        p.put("vnp_ReturnUrl", returnUrl);
        p.put("vnp_IpAddr", ip);
        p.put("vnp_CreateDate", now.format(FMT));
        p.put("vnp_ExpireDate", now.plusMinutes(expireMinutes).format(FMT));

        String data = ghep(p);
        return payUrl + "?" + data + "&vnp_SecureHash=" + hmac(data);
    }

    // Kiểm tra chữ ký VNPay gửi về (return URL và IPN đều dùng)
    public boolean hopLe(Map<String, String> params) {
        String hash = params.get("vnp_SecureHash");
        if (hash == null) return false;
        Map<String, String> p = new TreeMap<>(params);
        p.remove("vnp_SecureHash");
        p.remove("vnp_SecureHashType");
        return hmac(ghep(p)).equalsIgnoreCase(hash);
    }

    private String ghep(Map<String, String> p) {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : p.entrySet()) {
            if (e.getValue() == null || e.getValue().isEmpty()) continue;
            if (sb.length() > 0) sb.append('&');
            sb.append(e.getKey()).append('=')
              .append(URLEncoder.encode(e.getValue(), StandardCharsets.US_ASCII));
        }
        return sb.toString();
    }

    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(hashSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            StringBuilder sb = new StringBuilder();
            for (byte b : mac.doFinal(data.getBytes(StandardCharsets.UTF_8))) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Không ký được dữ liệu VNPay", e);
        }
    }
}
