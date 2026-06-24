#!/usr/bin/env python3
from flask import Flask, request, Response
import requests
from urllib.parse import urljoin
from typing import Tuple

app = Flask(__name__)

TARGET_DOMAIN = "https://nekos.best"
REQUIRED_USER_AGENT = "rubiko/1.0.0 (github.com/zlataovce/rubiko)"
PROXY_PORT = 5000
PROXY_HOST = "0.0.0.0"

EXCLUDED_HEADERS = {"host", "connection", "content-length", "transfer-encoding"}
HOP_BY_HOP_RESPONSE_HEADERS = {
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
}


def validate_user_agent() -> bool:
  user_agent = request.headers.get("User-Agent", "")
  return REQUIRED_USER_AGENT in user_agent


def forward_request(method: str, path: str) -> Tuple[Response, int]:
  target_url = urljoin(TARGET_DOMAIN, path)

  headers = {}
  for header, value in request.headers:
    if header.lower() not in EXCLUDED_HEADERS:
      headers[header] = value

  body = request.get_data()

  try:
    response = requests.request(
      method=method,
      url=target_url,
      headers=headers,
      data=body,
      params=request.args,
      allow_redirects=False,
      timeout=30,
      verify=True,
    )

    response_headers = {}
    for header, value in response.headers.items():
      if header.lower() not in HOP_BY_HOP_RESPONSE_HEADERS:
        response_headers[header] = value

    return Response(
      response.content,
      status=response.status_code,
      headers=response_headers,
    ), response.status_code

  except requests.exceptions.RequestException as e:
    return Response(
      f"Error forwarding request: {str(e)}",
      status=502,
    ), 502


@app.before_request
def check_user_agent():
  if not validate_user_agent():
    return Response(
      "Forbidden: Invalid or missing User Agent",
      status=403,
    ), 403


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
@app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
def proxy(path: str):
  method = request.method
  return forward_request(method, "/" + path if path else "/")


@app.errorhandler(404)
def not_found(error):
  return forward_request(request.method, request.path)


if __name__ == "__main__":
  app.run(host=PROXY_HOST, port=PROXY_PORT, debug=False)
