# Cadangan MySQL memakai mysqldump dari image MySQL yang sama dengan server (8.4), ditambah rclone untuk R2.
FROM mysql:8.4
ARG TARGETARCH
ARG RCLONE_VERSION=1.68.2
RUN microdnf install -y unzip && microdnf clean all \
 && curl -fsSL -o /tmp/rclone.zip "https://downloads.rclone.org/v${RCLONE_VERSION}/rclone-v${RCLONE_VERSION}-linux-${TARGETARCH}.zip" \
 && unzip -q /tmp/rclone.zip -d /tmp && mv /tmp/rclone-*/rclone /usr/local/bin/rclone && rm -rf /tmp/rclone*
COPY backup.sh loop.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/backup.sh /usr/local/bin/loop.sh
ENTRYPOINT ["/usr/local/bin/loop.sh"]
