package com.izakhono.pdfreader

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

class MainActivity : Activity() {
    private lateinit var pageImage: ImageView
    private lateinit var pageInfo: TextView
    private lateinit var previousButton: Button
    private lateinit var nextButton: Button

    private var renderer: PdfRenderer? = null
    private var descriptor: ParcelFileDescriptor? = null
    private var currentPage = 0
    private var bitmap: Bitmap? = null
    private var pdfName = "PDF document"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        pageImage = findViewById(R.id.pageImage)
        pageInfo = findViewById(R.id.pageInfo)
        previousButton = findViewById(R.id.previousButton)
        nextButton = findViewById(R.id.nextButton)

        findViewById<Button>(R.id.openButton).setOnClickListener { choosePdf() }
        previousButton.setOnClickListener { showPage(currentPage - 1) }
        nextButton.setOnClickListener { showPage(currentPage + 1) }

        if (savedInstanceState == null && intent?.data != null) {
            openUri(intent.data!!)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent?.data != null) openUri(intent.data!!)
    }

    private fun choosePdf() {
        startActivityForResult(
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/pdf"
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            }, REQUEST_OPEN_PDF
        )
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_OPEN_PDF && resultCode == RESULT_OK && data?.data != null) {
            try {
                contentResolver.takePersistableUriPermission(
                    data.data!!,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (_: SecurityException) { }
            openUri(data.data!!)
        }
    }

    private fun openUri(uri: Uri) {
        closePdf()
        try {
            pdfName = queryDisplayName(uri) ?: "PDF document"
            descriptor = contentResolver.openFileDescriptor(uri, "r")
            descriptor?.let { renderer = PdfRenderer(it) }
            currentPage = 0
            if (renderer?.pageCount ?: 0 > 0) showPage(0)
        } catch (e: Exception) {
            pageInfo.text = "Could not open PDF: ${e.localizedMessage ?: "unsupported file"}"
            pageImage.visibility = View.GONE
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        if (uri.scheme == "content") {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) return c.getString(0)
            }
        }
        return uri.lastPathSegment?.substringAfterLast('/')
    }

    private fun showPage(index: Int) {
        val pdf = renderer ?: return
        if (index !in 0 until pdf.pageCount) return
        bitmap?.recycle()
        val page = pdf.openPage(index)
        val width = resources.displayMetrics.widthPixels.coerceAtLeast(600)
        val scale = width.toFloat() / page.width.toFloat()
        val height = (page.height * scale).toInt().coerceAtLeast(1)
        bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap!!.eraseColor(android.graphics.Color.WHITE)
        page.render(bitmap!!, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
        page.close()
        pageImage.setImageBitmap(bitmap)
        pageImage.visibility = View.VISIBLE
        currentPage = index
        pageInfo.text = "$pdfName  •  Page ${index + 1} of ${pdf.pageCount}"
        previousButton.isEnabled = index > 0
        nextButton.isEnabled = index < pdf.pageCount - 1
    }

    private fun closePdf() {
        bitmap?.recycle()
        bitmap = null
        renderer?.close()
        renderer = null
        descriptor?.close()
        descriptor = null
    }

    override fun onDestroy() {
        closePdf()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_OPEN_PDF = 1001
    }
}
