/**
 * Lambda@Edge function para agregar headers CORS a las respuestas
 * 
 * Instrucciones:
 * 1. Crea una función Lambda en la región us-east-1
 * 2. Copia este código
 * 3. Publica una nueva versión
 * 4. En CloudFront, asocia esta función al evento "Viewer Response"
 */

exports.handler = async (event) => {
    const response = event.Records[0].cf.response;
    const request = event.Records[0].cf.request;
    const headers = response.headers || {};

    // Obtener el origen de la petición
    const origin = request.headers['origin'] 
        ? request.headers['origin'][0].value 
        : '*';

    // Agregar headers CORS
    headers['access-control-allow-origin'] = [{
        key: 'Access-Control-Allow-Origin',
        value: origin
    }];
    
    headers['access-control-allow-methods'] = [{
        key: 'Access-Control-Allow-Methods',
        value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    }];
    
    headers['access-control-allow-headers'] = [{
        key: 'Access-Control-Allow-Headers',
        value: 'Content-Type, Authorization, X-FM-Data-Session-Token, X-Requested-With, Accept, Origin'
    }];
    
    headers['access-control-max-age'] = [{
        key: 'Access-Control-Max-Age',
        value: '3600'
    }];

    headers['access-control-allow-credentials'] = [{
        key: 'Access-Control-Allow-Credentials',
        value: 'false'
    }];

    // Manejar preflight OPTIONS
    if (request.method === 'OPTIONS') {
        return {
            status: '200',
            statusDescription: 'OK',
            headers: headers,
            body: '',
            bodyEncoding: 'text'
        };
    }

    return response;
};

