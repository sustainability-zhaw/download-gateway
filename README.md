# download-gateway

Frontend service to download queries in Excel Format

## Rationale

The download-gateway allows to download the query results as MS Excel Workbooks. The service accepts a query object from the frontend and collects the related records from the databases and formats them into a spreadsheet.

## Operation

The service is a frontend service and needs exposure through a reverse proxy. The service itself is agnostic of access rules and will respond to all requests that are relayed by the reverse proxy. Although it does execute arbitary GraphQL queries, it needs to be protected against unauthorized access by an access control system like [authomator](https://github.com/phish108/authomator). 

The service will always respond to errors with a `400`-HTTP response code and an appropriate message for error recovery. 

The service responds only to `POST`-requests.  

The service expects a JSON object containing two top-level elements:

1. The active `category`
2. The requested `query`

If either of these elements is empty, the service considers the request as invalid and returns an `400` error status. This blocks that users can download the entire database in Excel format.

If a query yields an empty result, the service will also respond with a `400` error status and does not generate an empty Excel Workbook. 

A successful request will receive an Excel Workbook as response. 

The service sets the `content-disposition` header with the name of the file. Currently, the name is always `data_export.xls`. This will be configurable and/or dynamically generated at a later stage.

The frontend UI needs to trigger the download of the received workbook blob. 

## Configuration

The configuration is simple.

```yaml
service:
  dbhost: integration-test-db-1:8080
debug:
  level: debug
```

- `service.dbhost` is a simple string with the hostname and port of the database service/API gateway.
- `debug.level` sets the debug level of the system. Default value is `notice`. The download gateway uses [my service logger](https://github.com/phish108/node-service-logger) for logging with the respective logging levels. 

## Deployment

An example deployment can be found in the `contrib`-folger. The docker-compose-file `dev.yaml` can be used alongside with the services of [the integration test suite](https://github.com/sustainability-zhaw/integration-test).

### Debug levels 

A higher level includes the levels below. 

- `data` - logs queries and results
- `debug` - logs many details of the service 
- `info` - unused 
- `notice` - logs information of calling handlers and modules
- `warning` - unused
- `error` - logs errors thrown by functions, invalid requests etc. 
- `critical` - unused
- `alert` - logs configuration errors that prevent the service to be started
- `emergency` - unused
- `performance` - logs sessions and request metrices

It is recommended to use at least the `error` level to capture performance metrices, configuration and request errors.

## Internals

The service is organised into `handlers` and `models`. The `models` are responsible for handling all data-related functions, while the `handlers` deal with the different phases of a service request. 

### Models

#### DqlFilter

The `DqlFilter` Model is a variation of the similarly named model of the front end. The main difference to the frontend model is that it does not translate the object attributes into css selectors. Otherwise it uses the same logic to translate a query object into a DQL query. The model also loads the entire recordset from the database and does not paginate. 

The service uses only the `mainQuery()` function for loading the data. 

#### spreadsheetBuilder

The `spreadsheetBuilder` consists of a single public function: `buildSpreadsheet`. The function accepts the current `category` as presented by the incoming request and the data loaded by the `DqlFilter` Model. 

### Handlers

The service handlers are responsible to structure the difference phases of a service request 

#### buildfile

During this phase the data is loaded from the database and transformed into an Excel Workbook.

#### checkquery

This phase verifies that the presented query is valid and can get executed by the service. 

#### logheader

This logs the begging of a service request. This handler provides service metrices. 

#### logrequest

This logs the termination of a service request. This handler provides service metrices. If the `debug.level` is set to `data` this handler will also report the response body. 

#### respondHelo

This handler is used to verify the availability of the service. This handler is only active when a `GET`-request is used to access to the service. It always responds the JSON object `{"message": "helo"}`. This is useful to verify that the service is actually accessible for an remote client. 
