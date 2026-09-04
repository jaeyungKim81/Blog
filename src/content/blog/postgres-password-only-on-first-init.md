---
title: 'postgres 비밀번호를 바꿨는데 접속이 안 된다 — 빈 볼륨에서만 적용된다'
description: '도커 컴포즈에서 POSTGRES_PASSWORD 를 바꿔도 DB 비밀번호는 그대로다. 이미 만들어진 볼륨에는 적용되지 않기 때문. 데이터를 지우지 않고 맞추는 방법.'
pubDate: 'Sep 04 2026'
---

운영 배포를 준비하면서 DB 비밀번호를 강한 값으로 바꿨다. `.env` 를 고치고 다시 띄웠는데 이렇게 나왔다.

```
psycopg.OperationalError: connection failed:
  FATAL:  password authentication failed for user "postgres"
```

설정은 분명히 새 비밀번호인데 인증이 실패한다.

## 원인

postgres 공식 이미지의 `POSTGRES_PASSWORD` 는 **데이터 디렉터리가 비어 있을 때, 즉 최초 기동 시에만** 적용된다. 컨테이너가 시작할 때 초기화 스크립트가 도는데, 이미 데이터가 있으면 그 단계를 건너뛴다.

```
[최초 기동]  빈 볼륨  →  DB 생성 + 비밀번호 설정 + 스키마·시드 적용
[이후 기동]  기존 볼륨 →  그냥 기동. 환경변수는 무시된다
```

즉 **볼륨 안의 DB는 예전 비밀번호를 그대로 갖고 있고**, 애플리케이션만 새 비밀번호로 접속을 시도한 것이다.

같은 이유로 `schema.sql` 이나 시드 파일을 초기화 스크립트로 마운트해 뒀다면, 그것들도 최초 1회만 실행된다. 스키마를 바꿔도 기존 볼륨에는 반영되지 않는다.

## 확인

볼륨이 언제 만들어졌는지 보면 바로 드러난다.

```bash
docker volume inspect <프로젝트>_dbdata --format '{{.CreatedAt}}'
```

몇 주 전 날짜가 나오면 그 시점의 비밀번호가 들어 있는 것이다.

## `down -v` 로 풀면 안 된다

검색하면 "볼륨을 지우고 다시 만들라"는 답이 많이 나온다.

```bash
docker compose down -v      # ⚠ 데이터가 전부 사라진다
```

초기화 목적이면 맞지만, **운영 중이라면 그 안의 데이터가 함께 날아간다.** 나는 그 볼륨에 그날 작업한 내용이 들어 있어 쓸 수 없었다.

## 데이터를 지키면서 맞추기

DB 사용자 비밀번호를 직접 바꾸면 된다. 컨테이너 안으로 들어가서 실행한다.

```bash
docker compose exec db bash

psql -U postgres <<EOF
ALTER USER postgres PASSWORD '$POSTGRES_PASSWORD';
EOF
exit
```

`ALTER ROLE` 이 출력되면 성공이다. 애플리케이션이 요청마다 새로 연결하는 구조라면 재시작도 필요 없다.

컨테이너 안에서 하는 이유는 두 가지다.

**첫째, 비밀번호를 직접 타이핑하지 않아도 된다.** db 컨테이너에는 이미 `POSTGRES_PASSWORD` 환경변수로 새 값이 들어와 있다. 셸이 그것을 펼쳐 주므로 명령 이력이나 프로세스 목록에 값이 남지 않는다.

**둘째, 따옴표 문제를 피할 수 있다.** 밖에서 한 줄로 실행하려다 두 번 헛돌았다.

## 헛돈 두 가지

**psql 의 `-c` 는 psql 변수를 치환하지 않는다.**

```bash
psql -U postgres -v pw="$PW" -c "ALTER USER postgres PASSWORD :'pw'"
# → ERROR: syntax error at or near ":"
```

`-c` 로 넘긴 문자열은 서버로 그대로 전달된다. `:'변수'` 같은 psql 고유 문법은 **표준입력이나 파일로 읽을 때만** 해석된다. 그래서 위 예시처럼 here-doc 을 쓴다.

**PowerShell 5.1은 중첩된 따옴표를 네이티브 명령에 제대로 넘기지 못한다.**

```powershell
docker compose exec -T db bash -c "psql -c \"ALTER USER ...\""
# → 인자가 쪼개져 psql 에 'ALTER' 만 도달한다
```

컨테이너 안에 먼저 들어가면 리눅스 셸이 처리하므로 이 문제가 없다.

## 정리

- `POSTGRES_PASSWORD` 는 **빈 볼륨 최초 기동에만** 적용된다. 스키마·시드 초기화 스크립트도 마찬가지다
- 이미 만들어진 볼륨의 비밀번호는 `ALTER USER` 로 바꾼다
- `down -v` 는 데이터를 지운다. 초기화가 목적일 때만 쓴다
- 컨테이너 안에서 here-doc 으로 실행하면 따옴표 문제와 비밀번호 노출을 함께 피할 수 있다

설정 파일을 고쳤는데 동작이 안 바뀌면, **그 설정이 언제 읽히는지**를 먼저 확인하는 게 빠르다. 기동할 때 한 번만 읽는 값은 생각보다 많다.
