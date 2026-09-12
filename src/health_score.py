def calculate_health_score(anomaly_score, failure_probability, rul, max_rul=200):
    """
    100 = healthy, 0 = critical.
    """

    anomaly_health  = max(0, 100 - anomaly_score * 100)
    failure_health  = (1 - failure_probability) * 100
    rul_health      = min(100, (rul / max_rul) * 100)

    score = 0.4 * anomaly_health + 0.3 * failure_health + 0.3 * rul_health
    return round(max(0, min(100, score)), 2)


def get_health_status(score):
    if score >= 75:
        return "HEALTHY"
    elif score >= 50:
        return "CAUTION"
    elif score >= 25:
        return "WARNING"
    else:
        return "CRITICAL"