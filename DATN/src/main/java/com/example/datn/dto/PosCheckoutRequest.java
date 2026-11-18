package com.example.datn.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record PosCheckoutRequest(
        Integer idKhachHang,
        @Size(max = 100, message = "Tên khách hàng tối đa 100 ký tự") String tenKhachHang,
        @Size(max = 15, message = "Số điện thoại tối đa 15 ký tự") String soDienThoai,
        @Size(max = 20, message = "Mã giảm giá không hợp lệ") String maGiamGia,
        @NotBlank(message = "Chọn phương thức thanh toán")
        @Pattern(regexp = "Tiền mặt|Chuyển khoản", message = "Phương thức thanh toán không hợp lệ") String phuongThucThanhToan,
        @Size(max = 255, message = "Ghi chú tối đa 255 ký tự") String ghiChu,
        @NotEmpty(message = "Giỏ hàng trống") @Size(max = 50, message = "Giỏ hàng quá lớn") @Valid List<CartItemRequest> items
) {}
