//! This module implements the web API for the handling of zFCP storage service.
//!
//! The module offers two public functions:
//!
//! * `zfcp_service` which returns the Axum service.
//! * `zfcp_stream` which offers an stream that emits the zFCP-related events coming from D-Bus.

use agama_lib::{
    error::ServiceError, storage::{client::zfcp::ZFCPClient, model::zfcp::ZFCPController},
};
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use stream::{ZFCPControllerStream, ZFCPDiskStream};

mod stream;

use crate::{error::Error, web::common::EventStreams};

/// Returns the stream of zFCP-related events.
///
/// The stream combines the following events:
///
/// * Changes on the zFCP devices collection.
///
/// * `dbus`: D-Bus connection to use.
pub async fn zfcp_stream(dbus: &zbus::Connection) -> Result<EventStreams, Error> {
    let stream: EventStreams = vec![
        ("zfcp_disks", Box::pin(ZFCPDiskStream::new(dbus).await?)),
        ("zfcp_controllers", Box::pin(ZFCPControllerStream::new(dbus).await?)),
    ];
    Ok(stream)
}

#[derive(Clone)]
struct ZFCPState<'a> {
    client: ZFCPClient<'a>,
}

pub async fn zfcp_service<T>(dbus: &zbus::Connection) -> Result<Router<T>, ServiceError> {
    let client = ZFCPClient::new(dbus.clone()).await?;
    let state = ZFCPState { client };
    let router = Router::new()
        .route("/supported", get(supported))
        .route("/controllers", get(controllers))
        .route("/controllers/:controller_id/activate", post(activate_controller))
        .route("/controllers/:controller_id/wwpns", get(get_wwpns))
        .route("/controllers/:controller_id/wwpns/:wwpn_id/luns", get(get_luns))
        .route("/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/activate_disk", post(activate_disk))
        .route("/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/deactivate_disk", post(deactivate_disk))
        .route("/probe", post(probe))
        .with_state(state);
    Ok(router)
}

/// Returns whether zFCP technology is supported or not
#[utoipa::path(
    get,
    path="/supported",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "Returns whether ZFCP technology is supported")
    )
)]
async fn supported(State(state): State<ZFCPState<'_>>) -> Result<Json<bool>, Error> {
    Ok(Json(state.client.supported().await?))
}

/// Returns the list of known zFCP controllers.
#[utoipa::path(
    get,
    path="/controllers",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "List of ZFCP devices", body = Vec<ZFCPController>)
    )
)]
async fn controllers(State(state): State<ZFCPState<'_>>) -> Result<Json<Vec<ZFCPController>>, Error> {
    let devices = state
        .client
        .get_controllers()
        .await?
        .into_iter()
        .map(|(_path, device)| device)
        .collect();
    Ok(Json(devices))
}

/// Activate given zFCP controller.
#[utoipa::path(
    post,
    path="/controllers/:controller_id",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "controller activated")
    )
)]
async fn activate_controller(State(state): State<ZFCPState<'_>>, Path(controller_id): Path<String>) -> Result<(), Error> {
    state.client.activate_controller(controller_id.as_str()).await?;
    Ok(())
}

/// List wwpns for given controller.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "list of wwpns", body=Vec<String>)
    )
)]
async fn get_wwpns(State(state): State<ZFCPState<'_>>, Path(controller_id): Path<String>) -> Result<Json<Vec<String>>, Error> {
    let result = state.client.get_wwpns(controller_id.as_str()).await?;
    Ok(Json(result))
}

/// List luns for given controller and wwpn.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns/:wwpn_id/luns",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "list of luns", body=Vec<String>)
    )
)]
async fn get_luns(State(state): State<ZFCPState<'_>>, Path((controller_id, wwpn_id)): Path<(String, String)>) -> Result<Json<Vec<String>>, Error> {
    let result = state.client.get_luns(&controller_id, &wwpn_id).await?;
    Ok(Json(result))
}

/// Activates disk on given controller with given wwpn and lun.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/activate_disk",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "The activation was succesful.")
    )
)]
async fn activate_disk(State(state): State<ZFCPState<'_>>, Path((controller_id, wwpn_id, lun_id)): Path<(String, String, String)>) -> Result<(), Error> {
    state.client.activate_disk(&controller_id, &wwpn_id, &lun_id).await?;
    Ok(())
}

/// Deactivates disk on given controller with given wwpn and lun.
#[utoipa::path(
    post,
    path="/controllers/:controller_id/wwpns/:wwpn_id/luns/:lun_id/deactivate_disk",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "The activation was succesful.")
    )
)]
async fn deactivate_disk(State(state): State<ZFCPState<'_>>, Path((controller_id, wwpn_id, lun_id)): Path<(String, String, String)>) -> Result<(), Error> {
    state.client.deactivate_disk(&controller_id, &wwpn_id, &lun_id).await?;
    Ok(())
}

/// Find zFCP devices in the system.
#[utoipa::path(
    post,
    path="/probe",
    context_path="/api/storage/zfcp",
    responses(
        (status = OK, description = "The probing process ran successfully")
    )
)]
async fn probe(State(state): State<ZFCPState<'_>>) -> Result<Json<()>, Error> {
    Ok(Json(state.client.probe().await?))
}
