"""
capture_summary.py
Unmasking the Onion - Module 3: "What a local observer sees" walkthrough
Gabriella Campos, CprE 5300, Fall 2026

Summarizes a packet capture taken on the CLIENT side of an isolated home-lab
VM running Tor Browser. It reports only what a local network observer (an ISP
or campus network) could see: the remote IP/port the client talks to, TLS
metadata, and timing/volume per time bin. It never decrypts anything.

Usage:
    python3 capture_summary.py capture.pcapng --bin-ms 50 --out entry_series.csv

Requirements: tshark (Wireshark CLI) and pyshark (pip install pyshark).
The CSV of packets-per-bin can be loaded by the lab page to plot a real
"entry side" flow next to the synthetic ones.
"""

import argparse
import csv
from collections import Counter, defaultdict

import pyshark


def summarize(path, bin_ms):
    # Only TCP; Tor clients talk to their guard over TLS-on-TCP.
    cap = pyshark.FileCapture(path, display_filter="tcp", keep_packets=False)

    peers = Counter()            # (remote_ip, remote_port) -> packet count
    bytes_by_peer = Counter()
    sni_seen = set()             # TLS Server Name Indication values, if any
    bins = defaultdict(int)      # time bin -> packet count (all TCP)
    first_ts = None
    local_ip = None

    for pkt in cap:
        try:
            ts = float(pkt.sniff_timestamp)
            src, dst = pkt.ip.src, pkt.ip.dst
            sport, dport = int(pkt.tcp.srcport), int(pkt.tcp.dstport)
            length = int(pkt.length)
        except AttributeError:
            continue  # skip non-IPv4 or malformed packets

        if first_ts is None:
            first_ts = ts
            local_ip = src  # first packet in a client capture is outbound

        remote = (dst, dport) if src == local_ip else (src, sport)
        peers[remote] += 1
        bytes_by_peer[remote] += length
        bins[int((ts - first_ts) * 1000 // bin_ms)] += 1

        # Record SNI from TLS Client Hello if present (Tor uses random-looking names)
        if hasattr(pkt, "tls"):
            sni = getattr(pkt.tls, "handshake_extensions_server_name", None)
            if sni:
                sni_seen.add(str(sni))

    cap.close()
    return local_ip, peers, bytes_by_peer, sni_seen, bins


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pcap")
    ap.add_argument("--bin-ms", type=int, default=50)
    ap.add_argument("--out", default="entry_series.csv")
    args = ap.parse_args()

    local_ip, peers, bytes_by_peer, sni_seen, bins = summarize(args.pcap, args.bin_ms)

    print(f"Client (local) IP: {local_ip}")
    print("\nRemote endpoints a local observer can see (top 10 by packets):")
    for (ip, port), count in peers.most_common(10):
        print(f"  {ip}:{port:<6} packets={count:<7} bytes={bytes_by_peer[(ip, port)]}")
    print("\nTLS server names seen (Tor uses randomized names, not real sites):")
    for name in sorted(sni_seen) or ["(none captured)"]:
        print(f"  {name}")

    # Write packets-per-bin so the lab page can plot the real entry flow
    last_bin = max(bins) if bins else 0
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["bin", "packets"])
        for b in range(last_bin + 1):
            w.writerow([b, bins.get(b, 0)])
    print(f"\nWrote {last_bin + 1} bins of {args.bin_ms} ms to {args.out}")
    print("Note: content is encrypted; only addresses, sizes, and timing are visible.")


if __name__ == "__main__":
    main()
