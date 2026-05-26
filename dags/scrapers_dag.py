from datetime import datetime
from airflow import DAG
from airflow.providers.docker.operators.docker import DockerOperator
from docker.types import Mount

SCRAPER_IMAGE = "nuoto-scrapers:latest"

DATA_ROOT = "/mnt/09b6776d-0aa6-40e1-b37d-eb5004c761a8/Projects/nuoto"

CURRENT_YEAR = str(datetime.now().year)
PAST_YEAR = str(datetime.now().year - 1)

COMMON = dict(
    image=SCRAPER_IMAGE,
    auto_remove="force",
    docker_url="unix:///var/run/docker.sock",
    network_mode="bridge",
    mount_tmp_dir=False,
    timeout=3600,
)

with DAG(
    dag_id="nuoto_scrapers",
    schedule="0 2 * * *",
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["nuoto", "scrapers"],
) as dag:

    ficr = DockerOperator(
        task_id="scrape_ficr",
        command=["/app/ficr", CURRENT_YEAR],
        mounts=[
            Mount(source=f"{DATA_ROOT}/data_ficr", target="/app/data_ficr", type="bind")
        ],
        **COMMON,
    )

    federnuoto = DockerOperator(
        task_id="scrape_federnuoto",
        command=["/app/federnuoto", PAST_YEAR],
        mounts=[
            Mount(source=f"{DATA_ROOT}/data_federnuoto", target="/app/data_federnuoto", type="bind")
        ],
        **COMMON,
    )

    federnuoto_master = DockerOperator(
        task_id="scrape_federnuoto_master",
        command=["/app/federnuoto_master", PAST_YEAR],
        mounts=[
            Mount(source=f"{DATA_ROOT}/data_federnuoto_master", target="/app/data_federnuoto_master", type="bind")
        ],
        **COMMON,
    )

    federnuoto_records = DockerOperator(
        task_id="scrape_federnuoto_records",
        command=["/app/federnuoto_records", "-all"],
        mounts=[
            Mount(source=f"{DATA_ROOT}/data_federnuoto_records", target="/app/data_federnuoto_records", type="bind")
        ],
        **COMMON,
    )

    aggregator = DockerOperator(
        task_id="aggregate",
        command=[
            "/app/aggregator",
            "-data", "/app/data_ficr",
            "-data-federnuoto", "/app/data_federnuoto",
            "-data-federnuoto-master", "/app/data_federnuoto_master",
            "-data-federnuoto-records", "/app/data_federnuoto_records",
            "-redis-addr", "redis:6379",
            "-standard-logs",
        ],
        mounts=[
            Mount(source=f"{DATA_ROOT}/data_ficr",               target="/app/data_ficr",               type="bind"),
            Mount(source=f"{DATA_ROOT}/data_federnuoto",         target="/app/data_federnuoto",         type="bind"),
            Mount(source=f"{DATA_ROOT}/data_federnuoto_master",  target="/app/data_federnuoto_master",  type="bind"),
            Mount(source=f"{DATA_ROOT}/data_federnuoto_records", target="/app/data_federnuoto_records", type="bind"),
        ],
        **{**COMMON, "network_mode": "nuoto-scraper"},
    )

    # ficr runs in parallel with the federnuoto chain
    # federnuoto → federnuoto_master → federnuoto_records run sequentially
    # aggregator waits for all scrapers to finish
    federnuoto >> federnuoto_master >> federnuoto_records
    [ficr, federnuoto_records] >> aggregator
