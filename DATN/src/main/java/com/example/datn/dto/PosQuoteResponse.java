package com.example.datn.dto;

import java.math.BigDecimal;

public record PosQuoteResponse(
        BigDecimal tienTruocGiam,
        BigDecimal tienGiam,
        BigDecimal tongTien,
        String maGiamGia
) {}
