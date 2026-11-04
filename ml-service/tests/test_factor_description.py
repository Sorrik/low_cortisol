import pytest

from app.services.model_service import _factor_description


@pytest.mark.parametrize("factor", ["dow_sin", "dow_cos"])
def test_calendar_features_are_described_in_plain_russian(factor):
    text = _factor_description(factor, 0.11, 0.5)
    assert text == "День недели улучшает настроение на 0.11"


def test_direction_follows_the_sign_of_shap_value():
    assert "снижает" in _factor_description("stress_t", -0.4, 8.0)
    assert "улучшает" in _factor_description("stress_t", 0.4, 2.0)
