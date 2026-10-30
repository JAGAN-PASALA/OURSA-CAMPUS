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


def send_student_welcome_email(
    recipient: str,
    recipient_name: str,
    role: str,
    institution_name: str,
    institution_slug: str,
) -> tuple[bool, str | None]:
    from urllib.parse import urlencode

    base_url = settings.frontend_base_url.rstrip("/")
    login_url = f"{base_url}?{urlencode({'institution': institution_slug})}"

    message = EmailMessage()
    message["Subject"] = f"Welcome to {institution_name} – Your Account Details"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        f"Hello {recipient_name},\n\n"
        f"We are pleased to inform you that your account has been successfully "
        f"created on {institution_name}!\n\n"
        "Here are your account details:\n\n"
        f"Role: {role}\n"
        f"Registered Email: {recipient}\n"
        "Initial Password: Use the temporary password provided by your institution's administrator, if one was supplied. Otherwise, use your date of birth in DDMMYYYY format.\n"
        "Example: If your date of birth is 15 August 2005 and no temporary password was provided, enter 15082005.\n"
        f"Login Link: {login_url}\n\n"
        "For your security, please log in using the above details and change "
        "your default password immediately after your first login.\n\n"
        "If you experience any issues accessing your account, please contact "
        "your institution's administration team for assistance.\n\n"
        f"We are happy to welcome you to {institution_name} and wish you a "
        "wonderful experience!\n\n"
        "Warm regards,\n"
        "Team OURSA CAMPUS"
    )
    return _send(message)
