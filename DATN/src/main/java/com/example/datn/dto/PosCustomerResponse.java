package com.example.datn.dto;

public record PosCustomerResponse(
        Integer id,
        String maKhachHang,
        String hoVaTen,
        String soDienThoai,
        String email
) {}
