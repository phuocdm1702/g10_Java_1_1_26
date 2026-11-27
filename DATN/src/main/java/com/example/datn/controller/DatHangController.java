package com.example.datn.controller;

import com.example.datn.dto.BaoGiaRequest;
import com.example.datn.dto.BaoGiaResponse;
import com.example.datn.dto.DatHangRequest;
import com.example.datn.dto.DatHangResponse;
import com.example.datn.service.DonHangService;
import com.example.datn.service.VnpayService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/user/dat-hang")
@RequiredArgsConstructor
public class DatHangController {
    private final DonHangService service;
    private final VnpayService vnpay;

    @PostMapping("/tinh-tien")
    public BaoGiaResponse baoGia(@Valid @RequestBody BaoGiaRequest r) {
        return service.baoGia(r);
    }

    // Khách chọn VNPay: chỉ trả về link thanh toán. Đơn sẽ được tạo khi VNPay báo thành công.
    @PostMapping("/vnpay")
    public Map<String, String> datVnpay(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DatHangRequest r,
                                        HttpServletRequest http) {
        if (!"VNPAY".equals(r.phuongThuc())) throw new RuntimeException("Phương thức thanh toán không hợp lệ");
        DatHangResponse don = service.taoDonVnpay(Integer.valueOf(jwt.getSubject()), r);
        String ip = http.getRemoteAddr();
        if ("0:0:0:0:0:0:0:1".equals(ip) || "::1".equals(ip)) ip = "127.0.0.1";
        String url = vnpay.taoUrlThanhToan(don.maHoaDon(), don.tongTien(), ip);
        return Map.of("paymentUrl", url, "maHoaDon", don.maHoaDon());
    }

    @PostMapping
    public DatHangResponse dat(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody DatHangRequest r) {
        return service.dat(Integer.valueOf(jwt.getSubject()), r);
    }
}
