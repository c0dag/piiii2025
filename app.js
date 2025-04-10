const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware para processar JSON nas requisições
app.use(bodyParser.json());

// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// Conectar ao banco de dados SQLite
const db = new sqlite3.Database("./db/sensors.db", (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco de dados:", err.message);
    } else {
        console.log("Conectado ao banco de dados SQLite.");
        
        // Verifica se a tabela existe
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sensors'", (err, row) => {
            if (err) {
                console.error("Erro ao verificar tabela:", err.message);
            } else if (!row) {
                // Se a tabela não existe, cria com a estrutura correta
                db.run(`
                    CREATE TABLE sensors (
                        idSensor INTEGER NOT NULL,
                        lot INTEGER NOT NULL,
                        available BOOLEAN NOT NULL,
                        UNIQUE(idSensor, lot)
                    )
                `, (err) => {
                    if (err) {
                        console.error("Erro ao criar a tabela:", err.message);
                    } else {
                        console.log("Tabela 'sensors' criada com sucesso.");
                    }
                });
            } else {
                // A tabela já existe, vamos verificar se ela tem a restrição UNIQUE correta
                db.get("PRAGMA table_info(sensors)", (err, info) => {
                    if (err) {
                        console.error("Erro ao verificar estrutura da tabela:", err.message);
                    } else {
                        console.log("Tabela 'sensors' já existe. Usando estrutura existente.");
                    }
                });
            }
        });
    }
});

// Schema para verificação de dados
const schema = {
    "idSensor": "number",
    "lot": "number",
    "available": "boolean"
};

// Função para validar os dados recebidos
function validateJson(data, schema) {
    return Object.keys(schema).every(key => typeof data[key] === schema[key]);
}

// Endpoint para salvar dados dos sensores
app.post("/api/sensors", (req, res) => {
    const data = req.body;

    // Se os dados são um array
    if (Array.isArray(data)) {
        const queries = data.map(({ idSensor, lot, available }) => {
            return new Promise((resolve, reject) => {
                db.run(
                    `
                    INSERT INTO sensors (idSensor, lot, available)
                    VALUES (?, ?, ?)
                    ON CONFLICT(idSensor, lot) DO UPDATE SET
                        available = excluded.available
                    `,
                    [idSensor, lot, available],
                    function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(this.changes);
                        }
                    }
                );
            });
        });

        Promise.all(queries)
            .then(() => {
                res.status(200).json({
                    message: "Dados processados com sucesso",
                });
            })
            .catch((err) => {
                res.status(500).json({
                    message: "Erro ao processar os dados no banco de dados.",
                    error: err.message,
                });
            });
    } else {
        // Se os dados são um único objeto
        const { idSensor, lot, available } = data;

        db.run(
            `
            INSERT INTO sensors (idSensor, lot, available)
            VALUES (?, ?, ?)
            ON CONFLICT(idSensor, lot) DO UPDATE SET
                available = excluded.available
            `,
            [idSensor, lot, available],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        message: "Erro ao processar os dados no banco de dados.",
                        error: err.message,
                    });
                }

                res.status(200).json({
                    message: "Dados processados com sucesso",
                });
            }
        );
    }
});

// Endpoint para listar os dados dos sensores
app.get("/api/sensors", (req, res) => {
    db.all(`SELECT * FROM sensors`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                message: "Erro ao buscar os dados no banco de dados.",
                error: err.message,
            });
        }

        res.status(200).json({
            message: "Dados recuperados com sucesso",
            data: rows,
        });
    });
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando em localhost:${PORT}`);
});