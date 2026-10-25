from email.message import EmailMessage
import smtplib
import ssl

from config import get_settings


settings = get_settings()


def _send(message: EmailMessage) -> tuple[bool, str | None]:
    if not settings.email_enabled:
        return False, "SMTP is not configured"
    try:
        implicit_tls = settings.smtp_use_ssl or settings.smtp_port == 465
        smtp = smtplib.SMTP_SSL if implicit_tls else smtplib.SMTP
        options = {"context": ssl.create_default_context()} if implicit_tls else {}
        with smtp(settings.smtp_host, settings.smtp_port, timeout=15, **options) as server:
            if settings.smtp_use_tls and not implicit_tls:
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_username:
                password = settings.smtp_password or ""
                if settings.smtp_host == "smtp.gmail.com":
                    password = password.replace(" ", "")
                server.login(settings.smtp_username, password)
            server.send_message(message)
        return True, None
    except (OSError, smtplib.SMTPException) as exc:
        return False, str(exc)


def send_password_reset(recipient: str, recipient_name: str, institution_name: str, institution_slug: str, token: str) -> tuple[bool, str | None]:
    link = f"{settings.frontend_base_url.rstrip('/')}?reset_token={token}&institution={institution_slug}"
    message = EmailMessage()
    message["Subject"] = f"Reset your {institution_name} password"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        f"Hello {recipient_name},\n\nUse this secure link to reset your password:\n{link}\n\n"
        "The link expires in 30 minutes and can be used only once. If you did not request it, ignore this email."
    )
    return _send(message)


def send_configuration_test(recipient: str, institution_name: str) -> tuple[bool, str | None]:
    message = EmailMessage()
    message["Subject"] = f"{institution_name} email configuration test"
    message["From"] = settings.smtp_from_email or ""
    message["To"] = recipient
    message.set_content("Your OUR'S Smart Classroom email configuration is working.")
    return _send(message)
