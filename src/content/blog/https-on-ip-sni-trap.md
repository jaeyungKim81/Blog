---
title: 'IP로 HTTPS를 붙였는데 접속이 안 될 때 — SNI 함정'
description: '인증서 발급은 성공했다고 로그에 찍히는데 브라우저는 연결조차 못 한다. 사내망에서 도메인 없이 HTTPS를 쓸 때 겪는 문제와 원인, 해결 방법.'
pubDate: 'Sep 02 2026'
---

사내망 서버에 HTTPS를 붙이려고 했다. 도메인은 없고 IP만 있었다.

Caddy를 리버스 프록시로 세우고 `tls internal`로 자체 CA 인증서를 쓰기로 했다. `localhost`로는 잘 됐다. 그런데 다른 PC에서 붙게 하려고 사이트 주소를 IP로 바꾸자 접속이 되지 않았다.

```
TLSV1_ALERT_INTERNAL_ERROR
```

## 로그는 정상이라고 말한다

먼저 서버 로그를 봤다.

```json
{"level":"info","logger":"tls.obtain","msg":"obtaining certificate","identifier":"192.168.0.192"}
{"level":"info","logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"192.168.0.192","issuer":"local"}
{"level":"info","msg":"serving initial configuration"}
```

인증서를 정상적으로 발급했고, 오류가 하나도 없다. 설정도 맞다. 그런데 클라이언트에서는 핸드셰이크가 실패한다.

**이 조합이 진단을 어렵게 만든다.** 서버는 "다 됐다"고 하고 클라이언트는 "내부 오류"라고만 한다. 양쪽 다 원인을 가리키지 않는다.

## 원인은 SNI

TLS 핸드셰이크에서 클라이언트는 **접속하려는 이름**을 먼저 알려준다. 이걸 SNI(Server Name Indication)라고 한다.

```
클라이언트 → 서버 : "example.com 에 접속하려고 해"
서버      → 클라이언트 : "그럼 example.com 인증서를 줄게"
```

한 서버가 여러 도메인을 서비스할 때 어느 인증서를 내줄지 고르기 위한 장치다. 인증서는 암호화된 통신이 시작되기 *전에* 오가야 하므로, 이름을 평문으로 미리 알려주는 것이다.

문제는 여기다. **[RFC 6066](https://datatracker.ietf.org/doc/html/rfc6066#section-3)은 SNI에 IP 주소를 넣는 것을 금지한다.**

> Literal IPv4 and IPv6 addresses are not permitted in "HostName".

그래서 브라우저는 IP로 접속할 때 **SNI를 아예 보내지 않는다.** 이름이 오지 않으면 서버는 어느 사이트 설정을 쓸지 고르지 못하고, 핸드셰이크를 실패시킨다.

인증서는 잘 발급돼 있었다. 다만 **그걸 꺼낼 열쇠가 되는 이름이 오지 않았을 뿐이다.**

## 해결 — 기본 이름 지정

이름이 없을 때 쓸 기본값을 정해주면 된다. Caddy에서는 전역 옵션 한 줄이다.

```caddy
{
	default_sni 192.168.0.192
}

192.168.0.192, localhost {
	tls internal
	reverse_proxy backend:80
}
```

nginx라면 `default_server`가 같은 역할을 한다.

```nginx
server {
    listen 443 ssl default_server;
    server_name _;
    ...
}
```

적용 후 확인해보면 IP 접속과 이름 접속이 각각 맞는 인증서를 받는다.

```
IP 접속(SNI 없음)  → SAN ['192.168.0.192']
localhost 접속     → SAN ['localhost']
```

## 확인할 때 주의할 점

curl로 검증하다 한 번 더 헤맸다. Windows의 curl은 schannel(윈도우 인증서 저장소)을 쓰기 때문에 `--cacert`로 준 인증서를 기대대로 쓰지 않는다. TLS는 멀쩡한데 검증만 실패해서, 서버 문제로 오해하기 쉽다.

OpenSSL 기반 클라이언트로 확인하는 편이 확실하다.

```python
import socket, ssl

ctx = ssl.create_default_context(cafile="root.crt")
with socket.create_connection(("192.168.0.192", 443)) as s:
    with ctx.wrap_socket(s, server_hostname="192.168.0.192") as t:
        print(t.version())
        print([v for k, v in t.getpeercert()["subjectAltName"]])
```

참고로 파이썬의 `ssl`도 `server_hostname`에 IP를 주면 SNI로 보내지 않는다. 규격을 따르기 때문이다. 그래서 이 코드가 브라우저와 같은 상황을 재현한다.

## 정리

- IP로 HTTPS를 쓰면 브라우저는 SNI를 보내지 않는다. 규격상 넣을 수 없기 때문이다
- 이름이 없으면 서버가 인증서를 고르지 못해 핸드셰이크가 실패한다
- 기본 이름(`default_sni` / `default_server`)을 지정하면 해결된다
- 서버 로그에는 발급 성공만 남으므로, 로그만 보면 원인이 드러나지 않는다

애초에 도메인이 있으면 겪지 않을 문제다. 다만 사내망에 붙이는 단계에서는 IP로 시작하는 경우가 많고, 그때 이 함정을 만난다.
