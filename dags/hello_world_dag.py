from datetime import datetime
from airflow import DAG
from airflow.operators.python import PythonOperator

# Simple function to print to the logs
def print_hello():
    print("Hello World from Airflow 3.1.8!")
    return "Task completed"

with DAG(
    dag_id='hello_world_v3',
    # Every hour at minute 0
    schedule='0 * * * *',      
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=['example', 'stable'],
) as dag:

    hello_task = PythonOperator(
        task_id='print_hello_task',
        python_callable=print_hello,
    )

    hello_task