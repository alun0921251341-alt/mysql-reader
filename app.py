from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app)

# 資料庫設定 - 請修改這裡
DB_CONFIG = {
    "host": "nuc001.zzux.com",
    "port": 5010,
    "user": "root",
    "password": "photoprism_0413",
    "database": "shopee",
    "charset": "utf8mb4",
}


# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_db_connection():
    """取得資料庫連線"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except mysql.connector.Error as err:
        logger.error(f"資料庫連線失敗: {err}")
        return None

def init_database():
    """初始化資料庫，建立記錄表"""
    connection = get_db_connection()
    if not connection:
        return False
    
    try:
        cursor = connection.cursor()
        
        # 建立用戶讀取記錄表
        create_table_sql = """
        CREATE TABLE IF NOT EXISTS user_read_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userid VARCHAR(255) NOT NULL,
            shopid VARCHAR(255),
            read_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            read_count INT DEFAULT 1,
            last_read_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            source VARCHAR(50) DEFAULT 'python_api',
            INDEX idx_userid (userid),
            INDEX idx_read_time (read_time),
            UNIQUE KEY unique_userid (userid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
        
        cursor.execute(create_table_sql)
        connection.commit()
        logger.info("資料表初始化完成")
        return True
        
    except mysql.connector.Error as err:
        logger.error(f"建立資料表失敗: {err}")
        return False
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/test', methods=['GET'])
def test_connection():
    """測試 API 連線"""
    return jsonify({
        'status': 'success',
        'message': '連線正常',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/users', methods=['GET'])
def get_users():
    """讀取用戶資料"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
    
    try:
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        cursor = connection.cursor(dictionary=True)
        query = "SELECT * FROM users_filtered_with_shopid LIMIT %s OFFSET %s"
        cursor.execute(query, (limit, offset))
        
        users = cursor.fetchall()
        
        # 轉換日期時間為字串
        for user in users:
            for key, value in user.items():
                if isinstance(value, datetime):
                    user[key] = value.isoformat()
        
        logger.info(f"成功讀取 {len(users)} 筆用戶資料")
        
        return jsonify({
            'success': True,
            'users': users,
            'count': len(users),
            'timestamp': datetime.now().isoformat()
        })
        
    except mysql.connector.Error as err:
        logger.error(f"讀取用戶資料失敗: {err}")
        return jsonify({
            'success': False,
            'message': '讀取用戶資料失敗',
            'error': str(err)
        }), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/logs', methods=['POST'])
def log_read_activity():
    """記錄讀取活動"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
    
    try:
        data = request.get_json()
        logs = data.get('logs', [])
        
        if not logs or not isinstance(logs, list):
            return jsonify({
                'success': False,
                'message': '無效的記錄資料'
            }), 400
        
        cursor = connection.cursor()
        
        # 批量插入記錄
        for log in logs:
            userid = log.get('userid')
            shopid = log.get('shopid')
            timestamp = log.get('timestamp', datetime.now().isoformat())
            
            if userid:
                insert_sql = """
                INSERT INTO user_read_logs (userid, shopid, read_time, read_count, source)
                VALUES (%s, %s, %s, 1, 'python_api')
                ON DUPLICATE KEY UPDATE
                read_count = read_count + 1,
                last_read_time = NOW(),
                shopid = VALUES(shopid)
                """
                cursor.execute(insert_sql, (userid, shopid, timestamp))
        
        connection.commit()
        logger.info(f"成功記錄 {len(logs)} 筆讀取活動")
        
        return jsonify({
            'success': True,
            'message': f'成功記錄 {len(logs)} 筆資料',
            'count': len(logs)
        })
        
    except mysql.connector.Error as err:
        logger.error(f"記錄讀取活動失敗: {err}")
        connection.rollback()
        return jsonify({
            'success': False,
            'message': '記錄失敗',
            'error': str(err)
        }), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """取得統計資料"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        
        # 總體統計
        stats_sql = """
        SELECT 
            COUNT(DISTINCT userid) as total_users,
            SUM(read_count) as total_reads,
            MAX(last_read_time) as last_read_time,
            MIN(read_time) as first_read_time,
            COUNT(*) as total_records
        FROM user_read_logs
        """
        cursor.execute(stats_sql)
        stats = cursor.fetchone()
        
        # 今日統計
        daily_sql = """
        SELECT 
            COUNT(DISTINCT userid) as today_users,
            SUM(read_count) as today_reads
        FROM user_read_logs 
        WHERE DATE(last_read_time) = CURDATE()
        """
        cursor.execute(daily_sql)
        daily_stats = cursor.fetchone()
        
        # 合併統計資料
        result = {**stats, **daily_stats}
        
        # 轉換日期時間
        for key, value in result.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif value is None:
                result[key] = 0
        
        result['timestamp'] = datetime.now().isoformat()
        
        return jsonify(result)
        
    except mysql.connector.Error as err:
        logger.error(f"取得統計失敗: {err}")
        return jsonify({
            'success': False,
            'message': '取得統計失敗',
            'error': str(err)
        }), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/logs/<userid>', methods=['GET'])
def get_user_logs(userid):
    """取得特定用戶的讀取記錄"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
    
    try:
        cursor = connection.cursor(dictionary=True)
        query = """
        SELECT * FROM user_read_logs 
        WHERE userid = %s 
        ORDER BY last_read_time DESC
        """
        cursor.execute(query, (userid,))
        logs = cursor.fetchall()
        
        # 轉換日期時間
        for log in logs:
            for key, value in log.items():
                if isinstance(value, datetime):
                    log[key] = value.isoformat()
        
        return jsonify({
            'success': True,
            'userid': userid,
            'logs': logs
        })
        
    except mysql.connector.Error as err:
        logger.error(f"查詢用戶記錄失敗: {err}")
        return jsonify({
            'success': False,
            'message': '查詢失敗',
            'error': str(err)
        }), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

@app.route('/api/logs', methods=['DELETE'])
def clear_old_logs():
    """清除舊記錄"""
    connection = get_db_connection()
    if not connection:
        return jsonify({'success': False, 'message': '資料庫連線失敗'}), 500
    
    try:
        days = request.args.get('days', 30, type=int)
        
        cursor = connection.cursor()
        delete_sql = """
        DELETE FROM user_read_logs 
        WHERE read_time < DATE_SUB(NOW(), INTERVAL %s DAY)
        """
        cursor.execute(delete_sql, (days,))
        connection.commit()
        
        deleted_count = cursor.rowcount
        logger.info(f"清除了 {deleted_count} 條舊記錄")
        
        return jsonify({
            'success': True,
            'message': f'清除了 {deleted_count} 條舊記錄',
            'deleted_count': deleted_count
        })
        
    except mysql.connector.Error as err:
        logger.error(f"清除記錄失敗: {err}")
        return jsonify({
            'success': False,
            'message': '清除失敗',
            'error': str(err)
        }), 500
    finally:
        if connection.is_connected():
            cursor.close()
            connection.close()

if __name__ == '__main__':
    # 初始化資料庫
    if init_database():
        logger.info("資料庫初始化成功")
        print("🚀 MySQL Reader API 伺服器啟動中...")
        print("📍 API 端點: http://localhost:5000/api")
        print("⚠️  請記得修改 DB_CONFIG 中的資料庫設定！")
        app.run(debug=True, host='0.0.0.0', port=5000)
    else:
        logger.error("資料庫初始化失敗，請檢查設定")
        print("❌ 資料庫初始化失敗，請檢查 DB_CONFIG 設定")