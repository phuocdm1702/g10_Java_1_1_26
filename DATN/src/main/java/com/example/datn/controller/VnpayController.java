package com.example.datn.controller;

import com.example.datn.service.DonHangService;
import com.example.datn.service.VnpayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;

// Hai endpoint này là công khai (/api/public/**) vì VNPay gọi vào, không có JWT.
@Slf4j
@RestController
@RequestMapping("/api/public/vnpay")
@RequiredArgsConstructor
public class VnpayController {
    private final VnpayService vnpay;
    private final DonHangService donHang;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // VNPay đưa trình duyệt của khách về đây sau khi thanh toán
    @GetMapping("/return")
    public ResponseEntity<Void> returnUrl(@RequestParam Map<String, String> params) {
        String loi = frontendUrl + "/thanh-toan?loi=vnpay";
        if (!vnpay.hopLe(params)) return chuyenHuong(loi);
        String ma = params.get("vnp_TxnRef");
        if (!"00".equals(params.get("vnp_ResponseCode"))) {
            donHang.huyDonVnpay(ma);            // khách hủy hoặc lỗi: hủy đơn đang chờ, trả lại chỗ giữ
            return chuyenHuong(loi);
        }
        try {
            String kq = xacNhan(params);
            boolean ok = "OK".equals(kq) || "DA_XU_LY".equals(kq);
            return chuyenHuong(ok ? frontendUrl + "/dat-hang-thanh-cong/" + ma : loi);
        } catch (RuntimeException e) {
            log.error("VNPay return: lỗi khi xác nhận đơn {}", ma, e);
            return chuyenHuong(loi);
        }
    }

    // VNPay gọi từ máy chủ đến máy chủ để báo kết quả, kể cả khi khách đã đóng trình duyệt
    @GetMapping("/ipn")
    public Map<String, String> ipn(@RequestParam Map<String, String> params) {
        if (!vnpay.hopLe(params)) return Map.of("RspCode", "97", "Message", "Invalid Checksum");
        if (!"00".equals(params.get("vnp_ResponseCode"))) {
            donHang.huyDonVnpay(params.get("vnp_TxnRef"));
            return Map.of("RspCode", "00", "Message", "Confirm Success");
        }
        try {
            return switch (xacNhan(params)) {
                case "OK", "DA_XU_LY" -> Map.of("RspCode", "00", "Message", "Confirm Success");
                case "KHONG_TIM_THAY" -> Map.of("RspCode", "01", "Message", "Order not found");
                case "SAI_TIEN" -> Map.of("RspCode", "04", "Message", "Invalid amount");
                default -> Map.of("RspCode", "02", "Message", "Order already cancelled");
            };
        } catch (RuntimeException e) {
            log.error("VNPay IPN: lỗi khi xác nhận đơn {}", params.get("vnp_TxnRef"), e);
            return Map.of("RspCode", "99", "Message", "Unknown error");
        }
    }

    private String xacNhan(Map<String, String> p) {
        BigDecimal soTien = new BigDecimal(p.get("vnp_Amount")).movePointLeft(2);
        return donHang.xacNhanVnpay(p.get("vnp_TxnRef"), p.get("vnp_TransactionNo"), soTien);
    }

    private ResponseEntity<Void> chuyenHuong(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(url)).build();
    }
}
