package africa.izakhono.mobileintelligence

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Minimal authenticated session client.
 * Tokens are supplied by the caller, kept in memory, never logged or persisted here.
 */
class MobileIntelligenceApi(
    private val baseUrl: String,
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
) {
    data class SessionResult(
        val accountId: String,
        val email: String,
        val displayName: String,
        val organisationLabel: String,
        val organisationAccessAvailable: Boolean,
        val organisationAccessReason: String?
    )

    fun loadSession(
        bearerToken: String,
        onResult: (Result<SessionResult>) -> Unit
    ) {
        executor.execute {
            onResult(runCatching { requestSession(bearerToken) })
        }
    }

    private fun requestSession(token: String): SessionResult {
        require(token.matches(Regex("^[a-fA-F0-9]{64}$"))) { "Invalid session token format" }
        val root = URL(baseUrl)
        require(root.protocol == "https") { "Mobile Intelligence API requires HTTPS" }
        val endpoint = URL(root.toString().trimEnd('/') + "/api/mobile-intelligence/session")
        val connection = (endpoint.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
        }
        try {
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val code = runCatching { JSONObject(body).getJSONObject("error").getString("code") }.getOrDefault("REQUEST_FAILED")
                throw IllegalStateException("Session request failed ($status): $code")
            }
            val rootJson = JSONObject(body)
            val account = rootJson.getJSONObject("account")
            val access = rootJson.getJSONObject("organisation_access")
            return SessionResult(
                accountId = account.getString("id"),
                email = account.getString("email"),
                displayName = account.getString("display_name"),
                organisationLabel = account.optString("organisation_label", ""),
                organisationAccessAvailable = access.optBoolean("available", false),
                organisationAccessReason = access.optString("reason").takeIf { it.isNotBlank() }
            )
        } finally {
            connection.disconnect()
        }
    }
}
