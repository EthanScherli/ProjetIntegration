FROM ubuntu/bind9:latest

COPY config/named.conf /etc/bind/named.conf

COPY zones/python-gentil.ephec-ti.be.zone /var/cache/bind/python-gentil.ephec-ti.be.zone

RUN chown -R bind:bind /etc/bind/ && \
    chown -R bind:bind /var/cache/bind/

ENTRYPOINT ["/usr/sbin/named", "-g", "-c", "/etc/bind/named.conf", "-u", "bind"]
