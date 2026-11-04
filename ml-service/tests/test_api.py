def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_predict_rejects_invalid_body(client):
    assert client.post("/predict/", json={"user_id": "u"}).status_code == 422


def test_cold_start_uses_rules_without_a_model(client, make_request):
    response = client.post("/predict/", json=make_request("cold-user", days=3))
    assert response.status_code == 200
    body = response.json()
    assert body["phase"]["mode"] == "cold_start"
    assert body["predicted_mood"] is None
    assert body["model_version"] == "rule_based"
    assert body["recommendations"]


def test_train_is_skipped_with_too_little_data(client, make_request):
    response = client.post("/train/", json=make_request("short-user", days=5))
    assert response.status_code == 200
    assert response.json()["status"] == "skipped"


def test_train_then_predict_returns_a_bounded_mood(client, make_request):
    request = make_request("trained-user", days=35)
    assert client.post("/train/", json=request).status_code == 200

    response = client.post("/predict/", json=request)
    assert response.status_code == 200
    body = response.json()
    assert body["phase"]["mode"] != "cold_start"
    assert 1 <= body["predicted_mood"] <= 10
    assert body["confidence_lower"] <= body["predicted_mood"] <= body["confidence_upper"]


def test_transcribe_requires_audio(client):
    assert client.post("/transcribe/").status_code == 422
