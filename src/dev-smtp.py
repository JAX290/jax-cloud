"""极简本地 SMTP 捕获器（开发用）。

运行： python src/dev-smtp.py 1025
邮件内容会打印在终端，不真正投递。
"""

import socketserver
import sys


class SMTPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            self._handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def _handle(self):
        self.wfile.write(b"220 localhost dev-smtp\r\n")
        data_mode = False
        buffer = []

        while True:
            line = self.rfile.readline()
            if not line:
                break

            if data_mode:
                if line.strip() == b".":
                    data_mode = False
                    message = b"".join(buffer).decode("utf-8", "replace")
                    print("\n========== EMAIL ==========", flush=True)
                    print(message, flush=True)
                    print("========== END EMAIL ==========\n", flush=True)
                    self.wfile.write(b"250 OK\r\n")
                else:
                    buffer.append(line)
                continue

            command = line.decode("utf-8", "replace").strip()
            upper = command.upper()

            if upper.startswith("EHLO") or upper.startswith("HELO"):
                self.wfile.write(b"250-localhost\r\n250 OK\r\n")
            elif upper.startswith("MAIL FROM") or upper.startswith("RCPT TO"):
                self.wfile.write(b"250 OK\r\n")
            elif upper.startswith("DATA"):
                data_mode = True
                buffer = []
                self.wfile.write(b"354 End data with <CR><LF>.<CR><LF>\r\n")
            elif upper.startswith("QUIT"):
                self.wfile.write(b"221 Bye\r\n")
                break
            else:
                self.wfile.write(b"250 OK\r\n")


class SMTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 1025
    print(f"dev SMTP catcher on 127.0.0.1:{port}", flush=True)
    SMTPServer(("127.0.0.1", port), SMTPHandler).serve_forever()
