function generateOtpEmailTemplate(otp, userEmail) {
  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          .header {
            background-color: #f0f6ff;
            padding: 10px;
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            color: #0a3d62;
          }
          .otp-box {
            font-size: 28px;
            font-weight: bold;
            color: #e74c3c;
            text-align: center;
            margin: 20px 0;
            letter-spacing: 4px;
          }
          .footer {
            margin-top: 20px;
            font-size: 13px;
            color: #777;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">Your One-Time Password (OTP)</div>

          <p>Hello ${userEmail},</p>
          <p>Use the following OTP to complete your Admin login. This OTP is valid for only 10 minutes:</p>

          <div class="otp-box">${otp}</div>

          <p>If you didn’t request this OTP, you can safely ignore this email.</p>

          <div class="footer">
            © MG Construction – Secure Admin Login
          </div>
        </div>
      </body>
    </html>`;
}

module.exports = {
  generateOtpEmailTemplate
};