def refresh_trial_cache_for_trial(cursor, trial_id: int) -> None:
    cursor.execute(
        """
        REPLACE INTO trial_search_cache (
            trial_id, condition_count, intervention_count, criteria_count,
            inclusion_count, exclusion_count, avg_complexity_score,
            manual_review_count, updated_at
        )
        SELECT
            t.trial_id,
            COALESCE(tc.condition_count, 0),
            COALESCE(ti.intervention_count, 0),
            COALESCE(ec.criteria_count, 0),
            COALESCE(ec.inclusion_count, 0),
            COALESCE(ec.exclusion_count, 0),
            ec.avg_complexity_score,
            COALESCE(ec.manual_review_count, 0),
            CURRENT_TIMESTAMP
        FROM trials t
        LEFT JOIN (
            SELECT trial_id, COUNT(*) AS condition_count
            FROM trial_conditions
            WHERE trial_id = %s
            GROUP BY trial_id
        ) tc ON t.trial_id = tc.trial_id
        LEFT JOIN (
            SELECT trial_id, COUNT(*) AS intervention_count
            FROM trial_interventions
            WHERE trial_id = %s
            GROUP BY trial_id
        ) ti ON t.trial_id = ti.trial_id
        LEFT JOIN (
            SELECT
                trial_id,
                COUNT(*) AS criteria_count,
                SUM(CASE WHEN criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
                SUM(CASE WHEN criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
                ROUND(AVG(complexity_score), 2) AS avg_complexity_score,
                SUM(CASE WHEN requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
            FROM eligibility_criteria
            WHERE trial_id = %s
            GROUP BY trial_id
        ) ec ON t.trial_id = ec.trial_id
        WHERE t.trial_id = %s
        """,
        (trial_id, trial_id, trial_id, trial_id),
    )


def refresh_condition_summary_for_condition(cursor, condition_id: int) -> None:
    cursor.execute(
        """
        REPLACE INTO condition_summary_cache (condition_id, trial_count, updated_at)
        SELECT c.condition_id, COUNT(tc.trial_id), CURRENT_TIMESTAMP
        FROM conditions c
        LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
        WHERE c.condition_id = %s
        GROUP BY c.condition_id
        """,
        (condition_id,),
    )


def refresh_all_performance_caches(cursor) -> None:
    cursor.execute(
        """
        REPLACE INTO trial_search_cache (
            trial_id, condition_count, intervention_count, criteria_count,
            inclusion_count, exclusion_count, avg_complexity_score,
            manual_review_count, updated_at
        )
        SELECT
            t.trial_id,
            COALESCE(tc.condition_count, 0),
            COALESCE(ti.intervention_count, 0),
            COALESCE(ec.criteria_count, 0),
            COALESCE(ec.inclusion_count, 0),
            COALESCE(ec.exclusion_count, 0),
            ec.avg_complexity_score,
            COALESCE(ec.manual_review_count, 0),
            CURRENT_TIMESTAMP
        FROM trials t
        LEFT JOIN (SELECT trial_id, COUNT(*) AS condition_count FROM trial_conditions GROUP BY trial_id) tc ON t.trial_id = tc.trial_id
        LEFT JOIN (SELECT trial_id, COUNT(*) AS intervention_count FROM trial_interventions GROUP BY trial_id) ti ON t.trial_id = ti.trial_id
        LEFT JOIN (
            SELECT
                trial_id,
                COUNT(*) AS criteria_count,
                SUM(CASE WHEN criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
                SUM(CASE WHEN criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
                ROUND(AVG(complexity_score), 2) AS avg_complexity_score,
                SUM(CASE WHEN requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
            FROM eligibility_criteria
            GROUP BY trial_id
        ) ec ON t.trial_id = ec.trial_id
        """
    )

    cursor.execute(
        """
        REPLACE INTO condition_summary_cache (condition_id, trial_count, updated_at)
        SELECT c.condition_id, COUNT(tc.trial_id), CURRENT_TIMESTAMP
        FROM conditions c
        LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
        GROUP BY c.condition_id
        """
    )
